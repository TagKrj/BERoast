import AppError from '../utils/appError.js';
import { analysisDomainValues } from './analysis/analysisDomains.js';
import { analyzeDomain } from './analysis/domainAnalysis.service.js';
import { fallbackDomainIssues } from './analysis/localFallbackAnalysis.service.js';
import { normalizeFinalFindings } from './analysis/findingNormalizer.service.js';
import { createConcurrencyLimiter } from '../utils/concurrency.js';

const SIZE_LIMITS = {
  small: {
    reviewableFileCount: 50,
    reviewableBytes: 500_000,
    totalFileCount: 250,
  },
  medium: {
    reviewableFileCount: 250,
    reviewableBytes: 2_500_000,
    totalFileCount: 1_500,
    totalBytes: 75_000_000,
  },
};

export const classifyRepositorySize = async (stats) => {
  const reviewableFileCount = stats.reviewableFileCount ?? stats.fileCount;
  const reviewableBytes = stats.reviewableBytes ?? stats.totalBytes;
  const assetBytes = stats.assetBytes ?? 0;
  const ignoredFileCount = stats.ignoredFileCount ?? 0;
  const ignoredBytes = stats.ignoredBytes ?? 0;

  if (
    stats.treeTruncated ||
    reviewableFileCount > SIZE_LIMITS.medium.reviewableFileCount ||
    reviewableBytes > SIZE_LIMITS.medium.reviewableBytes ||
    stats.fileCount > SIZE_LIMITS.medium.totalFileCount ||
    stats.totalBytes > SIZE_LIMITS.medium.totalBytes
  ) {
    return {
      sizeLabel: 'large',
      sizeReason: `Large by deterministic rules after ignore rules: reviewable files=${reviewableFileCount}, reviewable bytes=${reviewableBytes}, kept files=${stats.fileCount}, kept bytes=${stats.totalBytes}, ignored files=${ignoredFileCount}, ignored bytes=${ignoredBytes}. A repository is large when reviewable files > ${SIZE_LIMITS.medium.reviewableFileCount}, reviewable bytes > ${SIZE_LIMITS.medium.reviewableBytes}, kept files > ${SIZE_LIMITS.medium.totalFileCount}, kept bytes > ${SIZE_LIMITS.medium.totalBytes}, or the GitHub tree is truncated.`,
    };
  }

  if (
    reviewableFileCount > SIZE_LIMITS.small.reviewableFileCount ||
    reviewableBytes > SIZE_LIMITS.small.reviewableBytes ||
    stats.fileCount > SIZE_LIMITS.small.totalFileCount
  ) {
    return {
      sizeLabel: 'medium',
      sizeReason: `Medium by deterministic rules after ignore rules: reviewable files=${reviewableFileCount}, reviewable bytes=${reviewableBytes}, kept files=${stats.fileCount}, kept bytes=${stats.totalBytes}, ignored files=${ignoredFileCount}, ignored bytes=${ignoredBytes}, asset bytes=${assetBytes}. It exceeds the small threshold but does not exceed the large threshold.`,
    };
  }

  return {
    sizeLabel: 'small',
    sizeReason: `Small by deterministic rules after ignore rules: reviewable files=${reviewableFileCount}, reviewable bytes=${reviewableBytes}, kept files=${stats.fileCount}, kept bytes=${stats.totalBytes}, ignored files=${ignoredFileCount}, ignored bytes=${ignoredBytes}. It is within the small thresholds.`,
  };
};

const priorityWeight = {
  p0: 4,
  p1: 3,
  p2: 2,
  p3: 1,
};
const ANALYSIS_MAX_CONCURRENT = Number.parseInt(
  process.env.ANALYSIS_MAX_CONCURRENT || '5',
  10,
);

const calculateScore = (domainFindings) => {
  const penalty = analysisDomainValues().reduce((total, domain) => {
    const findings = domainFindings[domain.key] || [];
    const multiplier = domain.scorePenaltyMultiplier || 3;
    const domainPenalty = findings.reduce(
      (sum, item) => sum + (priorityWeight[item.priority] || 1) * multiplier,
      0,
    );

    return total + domainPenalty;
  }, 0);

  return Math.max(0, 100 - penalty);
};

const gradeFromScore = (score) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
};

const shouldUseLocalFallback = (provider, error) =>
  provider === 'system_gemini' &&
  (error.statusCode >= 500 ||
    String(error.code || '').includes('GEMINI') ||
    String(error.code || '').includes('JSON_INVALID'));

const runAnalysisStep = async ({
  run,
  fallback,
  provider,
  codeSample,
  fallbackModel,
}) => {
  try {
    return await run();
  } catch (error) {
    if (!shouldUseLocalFallback(provider, error)) {
      throw error;
    }

    return {
      model: fallbackModel,
      findings: fallback(codeSample),
      fallbackReason: error.code || 'AI_PROVIDER_FAILED',
    };
  }
};

export const analyzeRepositoryCode = async ({
  codeSample,
  provider,
  openAiApiKey,
}) => {
  if (codeSample.selectedFileCount === 0) {
    throw new AppError(
      'No analyzable source files were found in this repository.',
      422,
      'NO_ANALYZABLE_FILES',
    );
  }

  const fallbackModel =
    provider === 'system_gemini'
      ? 'local-fallback-after-gemini-failure'
      : 'local-fallback';
  const runLimited = createConcurrencyLimiter(ANALYSIS_MAX_CONCURRENT);
  const analysisEntries = await Promise.all(
    analysisDomainValues().map((domain) =>
      runAnalysisStep({
        provider,
        codeSample,
        fallbackModel,
        fallback: (sample) =>
          fallbackDomainIssues({
            domainKey: domain.key,
            snippets: sample.snippets,
          }),
        run: () =>
          analyzeDomain({
            codeSample,
            domain,
            provider,
            openAiApiKey,
            runLimited,
          }),
      }).then((analysis) => [domain.key, analysis]),
    ),
  );
  const analyses = Object.fromEntries(analysisEntries);
  const domains = Object.fromEntries(
    analysisDomainValues().map((domain) => [
      domain.key,
      normalizeFinalFindings(analyses[domain.key]?.findings || [], {
        type: domain.key,
      }),
    ]),
  );
  const score = calculateScore(domains);
  const grade = gradeFromScore(score);
  const model =
    analysisDomainValues()
      .map((domain) => analyses[domain.key]?.model)
      .find(Boolean) || process.env.GEMINI_ANALYSIS_MODEL;

  return {
    provider,
    model,
    grade,
    score,
    domains,
    maintainability: domains.maintainability,
    architecture: domains.architecture,
    security: domains.security,
    robustness: domains.robustness,
    operational: domains.operational,
    interaction: domains.interaction,
  };
};
