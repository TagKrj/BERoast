import Repository from '../models/repository.model.js';
import RoastIssue from '../models/roastIssue.model.js';
import RoastRun from '../models/roastRun.model.js';
import {
  analyzeRepositoryCode,
  classifyRepositorySize,
} from './aiAnalysis.service.js';
import {
  getRepositoryMetadata,
  loadRepositoryCodeSample,
} from './githubRepo.service.js';
import AppError from '../utils/appError.js';
import { formatDateDisplay, toTitleCase } from '../utils/formatters.js';

const issueToResponse = (issue, index) => ({
  index: issue.index || index + 1,
  fileName: issue.filePath.split('/').pop(),
  filePath: issue.filePath,
  title: issue.title,
  description: issue.description,
  startLine: issue.startLine,
  endLine: issue.endLine,
  severity: issue.severity,
  severityDisplay: toTitleCase(issue.severity),
});

const buildCheckResponse = (roastRun) => ({
  roastId: roastRun.id,
  repository: {
    owner: roastRun.repoSnapshot.owner,
    name: roastRun.repoSnapshot.name,
    fullName: roastRun.repoSnapshot.fullName,
    htmlUrl: roastRun.repoSnapshot.htmlUrl,
    defaultBranch: roastRun.repoSnapshot.defaultBranch,
  },
  check: {
    fileCount: roastRun.check.fileCount,
    totalBytes: roastRun.check.totalBytes,
    sizeLabel: roastRun.check.sizeLabel,
    sizeDisplay: toTitleCase(roastRun.check.sizeLabel),
    sizeReason: roastRun.check.sizeReason,
    gptKeyRequired: roastRun.check.gptKeyRequired,
    nextAction: roastRun.check.gptKeyRequired
      ? 'provide_openai_api_key'
      : 'analyze_with_system_gemini',
  },
  ...(roastRun.check.gptKeyRequired && {
    advice:
      'Use a personal OpenAI API key to improve analysis quality for large repositories.',
  }),
});

const buildReportResponse = ({ roastRun, codeSmells, security }) => ({
  id: roastRun.id,
  roastDate: roastRun.result.roastDate.toISOString(),
  roastDateDisplay: roastRun.result.roastDateDisplay,
  repository: {
    owner: roastRun.repoSnapshot.owner,
    name: roastRun.repoSnapshot.name,
    fullName: roastRun.repoSnapshot.fullName,
    htmlUrl: roastRun.repoSnapshot.htmlUrl,
  },
  grade: roastRun.result.grade,
  score: roastRun.result.score,
  summaryTitle: roastRun.result.summaryTitle,
  summary: roastRun.result.summary,
  shortReview: roastRun.result.shortReview,
  repoInfo: {
    fileCount: roastRun.result.metrics.fileCount,
    sizeLabel: roastRun.result.metrics.sizeLabel,
    sizeDisplay: toTitleCase(roastRun.result.metrics.sizeLabel),
    totalCodeSmell: roastRun.result.metrics.codeSmellCount,
    totalSecurity: roastRun.result.metrics.securityCount,
    analysisType: roastRun.ai.analysisProvider,
    analysisTypeDisplay:
      roastRun.ai.analysisProvider === 'user_openai'
        ? 'Personal OpenAI API key analysis'
        : 'Gemini default system analysis',
  },
  issues: {
    codeSmells: codeSmells.map(issueToResponse),
    security: security.map(issueToResponse),
  },
});

const buildHistoryItem = (roastRun) => ({
  roastId: roastRun.id,
  grade: roastRun.result.grade,
  repositoryFullName: roastRun.repoSnapshot.fullName,
  repositoryUrl: roastRun.repoSnapshot.htmlUrl,
  roastDate: roastRun.result.roastDate.toISOString(),
  roastDateDisplay: roastRun.result.roastDateDisplay,
  sizeLabel: roastRun.result.metrics.sizeLabel,
  sizeDisplay: toTitleCase(roastRun.result.metrics.sizeLabel),
  totalCodeSmell: roastRun.result.metrics.codeSmellCount,
  totalSecurity: roastRun.result.metrics.securityCount,
  analysisType: roastRun.ai.analysisProvider,
});

export const checkRepository = async ({ repoUrl, userId }) => {
  const metadata = await getRepositoryMetadata(repoUrl);
  const size = await classifyRepositorySize(metadata.stats);
  const gptKeyRequired = size.sizeLabel === 'large';

  const repository = await Repository.findOneAndUpdate(
    {
      owner: metadata.repository.owner,
      name: metadata.repository.name,
    },
    {
      $set: {
        owner: metadata.repository.owner,
        name: metadata.repository.name,
        fullName: metadata.repository.fullName,
        htmlUrl: metadata.repository.htmlUrl,
        defaultBranch: metadata.repository.defaultBranch,
        visibility: 'public',
        lastKnown: {
          fileCount: metadata.stats.fileCount,
          totalBytes: metadata.stats.totalBytes,
          sizeLabel: size.sizeLabel,
          sizeReason: size.sizeReason,
          assessedBy: 'gemini',
          assessedAt: new Date(),
        },
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const roastRun = await RoastRun.create({
    userId,
    repositoryId: repository._id,
    input: {
      repoUrl,
    },
    repoSnapshot: metadata.repository,
    status: 'checked',
    check: {
      fileCount: metadata.stats.fileCount,
      totalBytes: metadata.stats.totalBytes,
      sizeLabel: size.sizeLabel,
      sizeReason: size.sizeReason,
      gptKeyRequired,
      checkedAt: new Date(),
    },
  });

  return buildCheckResponse(roastRun);
};

export const analyzeCheckedRepository = async ({
  roastId,
  userId,
  openAiApiKey,
}) => {
  const roastRun = await RoastRun.findOne({ _id: roastId, userId });

  if (!roastRun) {
    throw new AppError('Roast report not found.', 404, 'ROAST_NOT_FOUND');
  }

  if (!['checked', 'failed'].includes(roastRun.status)) {
    throw new AppError(
      'This roast is not ready for analysis.',
      409,
      'ROAST_NOT_READY_FOR_ANALYSIS',
    );
  }

  const wantsPersonalOpenAi = Boolean(openAiApiKey);
  const provider = wantsPersonalOpenAi ? 'user_openai' : 'system_gemini';

  if (roastRun.check.gptKeyRequired && !wantsPersonalOpenAi) {
    throw new AppError(
      'Personal OpenAI API key is required for large repositories.',
      400,
      'OPENAI_API_KEY_REQUIRED',
    );
  }

  roastRun.status = 'analyzing';
  roastRun.error = undefined;
  await roastRun.save();

  try {
    const metadata = await getRepositoryMetadata(roastRun.input.repoUrl);
    const codeSample = await loadRepositoryCodeSample(metadata);
    const analysis = await analyzeRepositoryCode({
      metadata,
      codeSample,
      provider,
      openAiApiKey,
    });

    const now = new Date();
    const codeSmellDocs = analysis.codeSmells.map((issue, index) => ({
      roastRunId: roastRun._id,
      userId,
      repositoryId: roastRun.repositoryId,
      type: 'code_smell',
      index: index + 1,
      ...issue,
    }));
    const securityDocs = analysis.security.map((issue, index) => ({
      roastRunId: roastRun._id,
      userId,
      repositoryId: roastRun.repositoryId,
      type: 'security',
      index: index + 1,
      ...issue,
    }));

    await RoastIssue.deleteMany({ roastRunId: roastRun._id });
    const createdIssues = await RoastIssue.insertMany([
      ...codeSmellDocs,
      ...securityDocs,
    ]);

    roastRun.status = 'completed';
    roastRun.ai = {
      analysisProvider: provider,
      model: analysis.model,
      usedPersonalApiKey: provider === 'user_openai',
    };
    roastRun.result = {
      roastDate: now,
      roastDateDisplay: formatDateDisplay(now),
      grade: analysis.grade,
      score: analysis.score,
      summaryTitle: analysis.summaryTitle,
      summary: analysis.summary,
      shortReview: analysis.shortReview,
      metrics: {
        fileCount: roastRun.check.fileCount,
        sizeLabel: roastRun.check.sizeLabel,
        codeSmellCount: analysis.codeSmells.length,
        securityCount: analysis.security.length,
      },
      completedAt: now,
    };
    await roastRun.save();

    const codeSmells = createdIssues.filter(
      (issue) => issue.type === 'code_smell',
    );
    const security = createdIssues.filter((issue) => issue.type === 'security');

    return buildReportResponse({ roastRun, codeSmells, security });
  } catch (error) {
    roastRun.status = 'failed';
    roastRun.error = {
      code: error.code || 'ANALYSIS_FAILED',
      message: error.message || 'Analysis failed.',
    };
    await roastRun.save();
    throw error;
  }
};

export const getRoastHistory = async ({
  userId,
  page = 1,
  limit = 10,
  search,
}) => {
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const normalizedLimit = Math.min(
    50,
    Math.max(1, Number.parseInt(limit, 10) || 10),
  );
  const filter = {
    userId,
    status: 'completed',
    result: { $exists: true },
  };

  if (search?.trim()) {
    filter['repoSnapshot.fullName'] = {
      $regex: search.trim(),
      $options: 'i',
    };
  }

  const [items, total] = await Promise.all([
    RoastRun.find(filter)
      .sort({ 'result.roastDate': -1, createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit),
    RoastRun.countDocuments(filter),
  ]);

  return {
    items: items.map(buildHistoryItem),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit) || 1,
    },
  };
};

export const getRoastReportDetail = async ({ roastId, userId }) => {
  const roastRun = await RoastRun.findOne({
    _id: roastId,
    userId,
    status: 'completed',
  });

  if (!roastRun?.result) {
    throw new AppError('Roast report not found.', 404, 'ROAST_NOT_FOUND');
  }

  const issues = await RoastIssue.find({ roastRunId: roastRun._id }).sort({
    type: 1,
    index: 1,
  });

  return buildReportResponse({
    roastRun,
    codeSmells: issues.filter((issue) => issue.type === 'code_smell'),
    security: issues.filter((issue) => issue.type === 'security'),
  });
};

export const deleteRoastReport = async ({ roastId, userId }) => {
  const roastRun = await RoastRun.findOne({
    _id: roastId,
    userId,
    status: 'completed',
  });

  if (!roastRun?.result) {
    throw new AppError('Roast report not found.', 404, 'ROAST_NOT_FOUND');
  }

  await RoastIssue.deleteMany({ roastRunId: roastRun._id, userId });
  await RoastRun.deleteOne({ _id: roastRun._id, userId });

  return {
    roastId: roastRun.id,
    repositoryFullName: roastRun.repoSnapshot.fullName,
    repositoryUrl: roastRun.repoSnapshot.htmlUrl,
    roastDate: roastRun.result.roastDate.toISOString(),
    roastDateDisplay: roastRun.result.roastDateDisplay,
  };
};
