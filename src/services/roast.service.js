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
import { callProviderJson } from './analysis/llmClient.service.js';
import AppError from '../utils/appError.js';
import { formatDateDisplay, toTitleCase } from '../utils/formatters.js';

const defaultSuggestionForIssue = (issue) => {
  if (issue.type === 'security') {
    return `Fix the security weakness in ${issue.filePath} by validating untrusted input, enforcing the relevant authorization or safety boundary, and replacing the risky pattern with a safer implementation. Add a regression test that proves the risky path is blocked.`;
  }

  return `Refactor ${issue.filePath} around this issue by reducing the problematic structure, separating responsibilities where needed, and keeping the existing behavior covered by focused tests.`;
};

const issueToResponse = (issue, index) => ({
  id: issue.id,
  type: issue.type,
  index: issue.index || index + 1,
  fileName: issue.filePath.split('/').pop(),
  filePath: issue.filePath,
  title: issue.title,
  description: issue.description,
  suggestion: issue.suggestion || defaultSuggestionForIssue(issue),
  startLine: issue.startLine,
  endLine: issue.endLine,
  severity: issue.severity,
  severityDisplay: toTitleCase(issue.severity),
  fixPrompt: issue.fixPrompt || null,
  fixPromptVersion: issue.fixPromptVersion || 0,
  fixPromptInstruction: issue.fixPromptInstruction || null,
  fixPromptInstructionAnalysis: issue.fixPromptInstructionAnalysis || null,
  fixPromptGeneratedAt: issue.fixPromptGeneratedAt
    ? issue.fixPromptGeneratedAt.toISOString()
    : null,
});

const summarizeIssuesBySeverity = (issues) =>
  issues.reduce(
    (summary, issue) => {
      summary.all += 1;

      if (issue.severity === 'high') {
        summary.totalHigh += 1;
      } else if (issue.severity === 'medium') {
        summary.totalMedium += 1;
      } else if (issue.severity === 'low') {
        summary.totalLow += 1;
      }

      return summary;
    },
    {
      all: 0,
      totalHigh: 0,
      totalMedium: 0,
      totalLow: 0,
    },
  );

const buildIssueGroupResponse = (issues) => ({
  ...summarizeIssuesBySeverity(issues),
  items: issues.map(issueToResponse),
});

const normalizePromptInstruction = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1000) : null;
};

const analyzePromptInstruction = (instruction) => {
  if (!instruction) {
    return null;
  }

  const normalized = instruction.toLowerCase();
  const focus = [];

  if (
    /\b(test|unit test|integration test|coverage|kiểm thử)\b/.test(normalized)
  ) {
    focus.push('include a test-focused fix plan');
  }

  if (/\b(diff|patch|code change|đoạn code|code)\b/.test(normalized)) {
    focus.push('return concrete code changes or a diff');
  }

  if (/\b(short|brief|concise|ngắn|tóm tắt)\b/.test(normalized)) {
    focus.push('keep the prompt concise');
  }

  if (
    /\b(detail|detailed|step by step|chi tiết|từng bước)\b/.test(normalized)
  ) {
    focus.push('make the prompt detailed and step-by-step');
  }

  if (/\b(security|secure|bảo mật|vulnerability)\b/.test(normalized)) {
    focus.push('emphasize security impact and safe remediation');
  }

  if (/\b(refactor|clean code|maintainable|tối ưu|clean)\b/.test(normalized)) {
    focus.push('emphasize maintainable refactoring');
  }

  if (/\b(no test|không test|không cần test)\b/.test(normalized)) {
    focus.push('do not make tests the main output');
  }

  if (focus.length === 0) {
    focus.push('apply the user requested adjustment directly');
  }

  return `User wants to ${focus.join(', ')}.`;
};

const buildIssueFixPrompt = ({
  issue,
  roastRun,
  instruction,
  instructionAnalysis,
}) => {
  const issueType =
    issue.type === 'security' ? 'security issue' : 'code smell issue';
  const lineRange =
    issue.startLine === issue.endLine
      ? `${issue.startLine}`
      : `${issue.startLine}-${issue.endLine}`;

  return [
    `You are a senior software engineer. Help me fix this ${issueType} in my repository.`,
    '',
    `Repository: ${roastRun.repoSnapshot.fullName}`,
    `Repository URL: ${roastRun.repoSnapshot.htmlUrl}`,
    `File: ${issue.filePath}`,
    `Lines: ${lineRange}`,
    `Severity: ${toTitleCase(issue.severity)}`,
    `Issue title: ${issue.title}`,
    '',
    'Issue description:',
    issue.description,
    '',
    'Suggested direction:',
    issue.suggestion || defaultSuggestionForIssue(issue),
    '',
    'Requirements:',
    '1. Preserve the existing public behavior unless the current behavior is unsafe.',
    '2. Keep the patch focused on this issue only.',
    '3. Show the exact code changes or a clear diff.',
    '4. Explain why the fix resolves the issue.',
    '5. Mention any tests or manual checks I should run after applying the fix.',
    ...(instruction
      ? [
          '',
          'User regeneration request:',
          instruction,
          '',
          'Interpreted request:',
          instructionAnalysis,
          '',
          'Adjust the final answer to follow the user regeneration request above. If the request conflicts with safe engineering practice, explain the safer alternative and proceed with the safer fix.',
        ]
      : [
          '',
          'Prompt style:',
          'Produce a focused, review-ready fix with the smallest safe code change, a short explanation, and relevant test or manual verification steps.',
        ]),
  ].join('\n');
};

const buildPromptGenerationAiPrompt = ({
  issue,
  roastRun,
  instruction,
  previousPrompt,
  generationNumber,
}) => {
  const issueType =
    issue.type === 'security' ? 'security issue' : 'code smell issue';
  const lineRange =
    issue.startLine === issue.endLine
      ? `${issue.startLine}`
      : `${issue.startLine}-${issue.endLine}`;

  return `
You are a senior software engineering prompt designer.
Your task is to generate a high-quality repair prompt for a developer to paste into a coding assistant.

You MUST analyze the user's regenerate instruction when it is provided and create a meaningfully different prompt that follows that instruction.
Do NOT simply rotate a template.
Do NOT return markdown fences.
Return ONLY valid JSON with this exact shape:
{
  "instructionAnalysis": "<brief analysis of what the user wants changed in the regenerated prompt>",
  "fixPrompt": "<the full regenerated prompt to give to a coding assistant>"
}

Repository:
- Name: ${roastRun.repoSnapshot.fullName}
- URL: ${roastRun.repoSnapshot.htmlUrl}

Prompt generation:
- Version to generate: ${generationNumber}
- Goal: create a meaningfully different and more useful prompt than the previous version when a previous prompt exists.

Issue:
- Type: ${issueType}
- File: ${issue.filePath}
- Lines: ${lineRange}
- Severity: ${toTitleCase(issue.severity)}
- Title: ${issue.title}
- Description: ${issue.description}
- Suggested direction: ${issue.suggestion || defaultSuggestionForIssue(issue)}

${previousPrompt ? `Previous prompt:\n${previousPrompt}\n` : ''}

User regenerate instruction:
${instruction || 'No custom instruction. Generate a clear first prompt for fixing the issue.'}

Rules for the generated fixPrompt:
1. It must be directly usable as a prompt for another coding assistant.
2. It must include repository, file, line range, issue title, issue description, and suggested direction.
3. It must follow the user's regenerate instruction as the highest-priority style/content requirement.
4. It must not be identical to the previous prompt.
5. It must ask for exact code changes or a clear diff.
6. It must ask for explanation of why the fix works.
7. It must ask for tests or manual checks unless the user explicitly asks not to include tests.
8. If the user request is unsafe or conflicts with good engineering practice, the prompt must ask for the safer alternative.
`;
};

const normalizeGeneratedPromptResult = ({
  result,
  issue,
  roastRun,
  instruction,
  fallbackAnalysis,
}) => {
  const instructionAnalysis =
    typeof result?.instructionAnalysis === 'string' &&
    result.instructionAnalysis.trim()
      ? result.instructionAnalysis.trim()
      : fallbackAnalysis;
  const fixPrompt =
    typeof result?.fixPrompt === 'string' && result.fixPrompt.trim()
      ? result.fixPrompt.trim()
      : buildIssueFixPrompt({
          issue,
          roastRun,
          instruction,
          instructionAnalysis,
        });

  return {
    instructionAnalysis,
    fixPrompt,
  };
};

const generateIssueFixPromptWithAi = async ({
  issue,
  roastRun,
  instruction,
  generationNumber,
  requireAi = false,
}) => {
  const fallbackAnalysis = analyzePromptInstruction(instruction);

  try {
    const response = await callProviderJson({
      provider: 'system_gemini',
      errorPrefix: 'FIX_PROMPT_GENERATION',
      prompt: buildPromptGenerationAiPrompt({
        issue,
        roastRun,
        instruction,
        previousPrompt: issue.fixPrompt,
        generationNumber,
      }),
    });

    return normalizeGeneratedPromptResult({
      result: response.result,
      issue,
      roastRun,
      instruction,
      fallbackAnalysis,
    });
  } catch (error) {
    if (requireAi) {
      throw new AppError(
        'AI could not analyze regenerateInstruction to regenerate the prompt.',
        error.statusCode || 502,
        error.code || 'FIX_PROMPT_REGENERATION_FAILED',
      );
    }

    const instructionAnalysis = fallbackAnalysis
      ? `${fallbackAnalysis} AI prompt regeneration was unavailable, so a local fallback prompt was generated.`
      : 'AI prompt generation was unavailable, so a local fallback prompt was generated.';

    return {
      instructionAnalysis,
      fixPrompt: buildIssueFixPrompt({
        issue,
        roastRun,
        instruction,
        instructionAnalysis,
      }),
    };
  }
};

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

const buildReportResponse = ({ roastRun, codeSmells, security }) => {
  const repoSeveritySummary = summarizeIssuesBySeverity([
    ...codeSmells,
    ...security,
  ]);

  return {
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
    repoInfo: {
      fileCount: roastRun.result.metrics.fileCount,
      sizeLabel: roastRun.result.metrics.sizeLabel,
      sizeDisplay: toTitleCase(roastRun.result.metrics.sizeLabel),
      totalCodeSmell: roastRun.result.metrics.codeSmellCount,
      totalSecurity: roastRun.result.metrics.securityCount,
      totalHigh: repoSeveritySummary.totalHigh,
      totalMedium: repoSeveritySummary.totalMedium,
      totalLow: repoSeveritySummary.totalLow,
      analysisType: roastRun.ai.analysisProvider,
      analysisTypeDisplay:
        roastRun.ai.analysisProvider === 'user_openai'
          ? 'Personal OpenAI API key analysis'
          : 'Gemini default system analysis',
    },
    issues: {
      codeSmells: buildIssueGroupResponse(codeSmells),
      security: buildIssueGroupResponse(security),
    },
  };
};

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

export const generateIssuePrompt = async ({
  roastId,
  issueId,
  userId,
  regenerateInstruction,
}) => {
  const roastRun = await RoastRun.findOne({
    _id: roastId,
    userId,
    status: 'completed',
  });

  if (!roastRun?.result) {
    throw new AppError('Roast report not found.', 404, 'ROAST_NOT_FOUND');
  }

  const issue = await RoastIssue.findOne({
    _id: issueId,
    roastRunId: roastRun._id,
    userId,
  });

  if (!issue) {
    throw new AppError('Roast issue not found.', 404, 'ROAST_ISSUE_NOT_FOUND');
  }

  if (!issue.suggestion) {
    issue.suggestion = defaultSuggestionForIssue(issue);
  }

  const normalizedInstruction = normalizePromptInstruction(
    regenerateInstruction,
  );

  if (issue.fixPrompt && !normalizedInstruction) {
    throw new AppError(
      'Regenerate prompt requires an instruction.',
      400,
      'REGENERATE_PROMPT_INSTRUCTION_REQUIRED',
    );
  }

  const nextVersion = (issue.fixPromptVersion || 0) + 1;
  const generatedPrompt = await generateIssueFixPromptWithAi({
    issue,
    roastRun,
    instruction: normalizedInstruction,
    generationNumber: nextVersion,
    requireAi: Boolean(normalizedInstruction),
  });
  issue.fixPromptVersion = nextVersion;
  issue.fixPromptInstruction = normalizedInstruction;
  issue.fixPromptInstructionAnalysis = generatedPrompt.instructionAnalysis;
  issue.fixPrompt = generatedPrompt.fixPrompt;
  issue.fixPromptGeneratedAt = new Date();
  await issue.save();

  return issueToResponse(issue, issue.index - 1);
};
