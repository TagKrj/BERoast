import AppError from '../utils/appError.js';
import { analyzeCodeSmells } from './analysis/codeSmellAnalysis.service.js';
import { analyzeSecurityIssues } from './analysis/securityAnalysis.service.js';
import {
  fallbackCodeSmells,
  fallbackSecurityIssues,
} from './analysis/localFallbackAnalysis.service.js';
import { normalizeFinalFindings } from './analysis/findingNormalizer.service.js';

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

const severityWeight = {
  low: 1,
  medium: 2,
  high: 3,
};

const calculateScore = ({ codeSmells, security }) => {
  const codeSmellPenalty = codeSmells.reduce(
    (total, item) => total + severityWeight[item.severity] * 3,
    0,
  );
  const securityPenalty = security.reduce(
    (total, item) => total + severityWeight[item.severity] * 7,
    0,
  );

  return Math.max(0, 100 - codeSmellPenalty - securityPenalty);
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
  const codeSmellAnalysis = await runAnalysisStep({
    provider,
    codeSample,
    fallbackModel,
    fallback: fallbackCodeSmells,
    run: () => analyzeCodeSmells({ codeSample, provider, openAiApiKey }),
  });
  const securityAnalysis = await runAnalysisStep({
    provider,
    codeSample,
    fallbackModel,
    fallback: fallbackSecurityIssues,
    run: () => analyzeSecurityIssues({ codeSample, provider, openAiApiKey }),
  });

  const codeSmells = normalizeFinalFindings(codeSmellAnalysis.findings, {
    type: 'code_smell',
  });
  const security = normalizeFinalFindings(securityAnalysis.findings, {
    type: 'security',
  });
  const score = calculateScore({ codeSmells, security });
  const grade = gradeFromScore(score);

  return {
    provider,
    model:
      codeSmellAnalysis.model ||
      securityAnalysis.model ||
      process.env.GEMINI_ANALYSIS_MODEL,
    grade,
    score,
    codeSmells,
    security,
  };
};
