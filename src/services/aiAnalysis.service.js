import AppError from '../utils/appError.js';
import { analyzeCodeSmells } from './analysis/codeSmellAnalysis.service.js';
import { analyzeSecurityIssues } from './analysis/securityAnalysis.service.js';

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

  if (
    stats.treeTruncated ||
    reviewableFileCount > SIZE_LIMITS.medium.reviewableFileCount ||
    reviewableBytes > SIZE_LIMITS.medium.reviewableBytes ||
    stats.fileCount > SIZE_LIMITS.medium.totalFileCount ||
    stats.totalBytes > SIZE_LIMITS.medium.totalBytes
  ) {
    return {
      sizeLabel: 'large',
      sizeReason: `Large by deterministic rules: reviewable files=${reviewableFileCount}, reviewable bytes=${reviewableBytes}, total files=${stats.fileCount}, total bytes=${stats.totalBytes}. A repository is large when reviewable files > ${SIZE_LIMITS.medium.reviewableFileCount}, reviewable bytes > ${SIZE_LIMITS.medium.reviewableBytes}, total files > ${SIZE_LIMITS.medium.totalFileCount}, total bytes > ${SIZE_LIMITS.medium.totalBytes}, or the GitHub tree is truncated.`,
    };
  }

  if (
    reviewableFileCount > SIZE_LIMITS.small.reviewableFileCount ||
    reviewableBytes > SIZE_LIMITS.small.reviewableBytes ||
    stats.fileCount > SIZE_LIMITS.small.totalFileCount
  ) {
    return {
      sizeLabel: 'medium',
      sizeReason: `Medium by deterministic rules: reviewable files=${reviewableFileCount}, reviewable bytes=${reviewableBytes}, total files=${stats.fileCount}, total bytes=${stats.totalBytes}, asset bytes=${assetBytes}. It exceeds the small threshold but does not exceed the large threshold.`,
    };
  }

  return {
    sizeLabel: 'small',
    sizeReason: `Small by deterministic rules: reviewable files=${reviewableFileCount}, reviewable bytes=${reviewableBytes}, total files=${stats.fileCount}, total bytes=${stats.totalBytes}. It is within the small thresholds.`,
  };
};

const severityWeight = {
  low: 1,
  medium: 2,
  high: 3,
};

const countBySeverity = (items) =>
  items.reduce(
    (counts, item) => {
      counts[item.severity] += 1;
      return counts;
    },
    {
      low: 0,
      medium: 0,
      high: 0,
    },
  );

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

const buildSummary = ({ metadata, codeSmells, security, score, grade }) => {
  const codeSmellCounts = countBySeverity(codeSmells);
  const securityCounts = countBySeverity(security);
  const totalIssues = codeSmells.length + security.length;

  if (totalIssues === 0) {
    return {
      summaryTitle: 'No validated code smell or security issues found',
      summary: `The validated analysis did not find strong code smell or security evidence in the sampled source files from ${metadata.repository.fullName}.`,
      shortReview: [
        'No validated code smell findings remained after precision filtering.',
        'No validated security findings remained after precision filtering.',
        `Final score is ${score} with grade ${grade}.`,
      ],
    };
  }

  const hasHighRisk = codeSmellCounts.high > 0 || securityCounts.high > 0;
  const summaryTitle = hasHighRisk
    ? 'High-priority validated issues found'
    : 'Validated maintainability and security issues found';

  return {
    summaryTitle,
    summary: `${metadata.repository.fullName} was analyzed with a two-phase pipeline: high-recall detection followed by precision validation. The final result contains ${codeSmells.length} validated code smell issue(s) and ${security.length} validated security issue(s). Security findings are weighted more heavily in the score because they have higher operational risk.`,
    shortReview: [
      `Code smell findings: ${codeSmells.length} total (${codeSmellCounts.high} high, ${codeSmellCounts.medium} medium, ${codeSmellCounts.low} low).`,
      `Security findings: ${security.length} total (${securityCounts.high} high, ${securityCounts.medium} medium, ${securityCounts.low} low).`,
      `Final score is ${score} with grade ${grade}.`,
    ],
  };
};

export const analyzeRepositoryCode = async ({
  metadata,
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

  const [codeSmellAnalysis, securityAnalysis] = await Promise.all([
    analyzeCodeSmells({ codeSample, provider, openAiApiKey }),
    analyzeSecurityIssues({ codeSample, provider, openAiApiKey }),
  ]);

  const codeSmells = codeSmellAnalysis.findings;
  const security = securityAnalysis.findings;
  const score = calculateScore({ codeSmells, security });
  const grade = gradeFromScore(score);
  const summary = buildSummary({
    metadata,
    codeSmells,
    security,
    score,
    grade,
  });

  return {
    provider,
    model:
      codeSmellAnalysis.model ||
      securityAnalysis.model ||
      process.env.GEMINI_ANALYSIS_MODEL,
    grade,
    score,
    ...summary,
    codeSmells,
    security,
  };
};
