import { callProviderJson } from './llmClient.service.js';
import {
  getCachedFileDetections,
  rulesContentHash,
  saveFileDetectionsToCache,
} from './fileAnalysisCache.service.js';
import {
  ensureArrayResult,
  normalizeFinalFindings,
} from './findingNormalizer.service.js';
import { fallbackDomainIssues } from './localFallbackAnalysis.service.js';
import { loadRuleFile } from './ruleLoader.service.js';

const getFileName = (filePath) => filePath.split('/').pop() || filePath;
const DETECTION_BATCH_SIZE = Number.parseInt(
  process.env.ANALYSIS_DETECTION_BATCH_SIZE || '3',
  10,
);
const DOMAIN_MAX_FILES = Number.parseInt(
  process.env.ANALYSIS_DOMAIN_MAX_FILES || '50',
  10,
);

const chunkFiles = (files) => {
  const batchSize = Number.isFinite(DETECTION_BATCH_SIZE)
    ? Math.max(1, DETECTION_BATCH_SIZE)
    : 4;
  const chunks = [];

  for (let index = 0; index < files.length; index += batchSize) {
    chunks.push(files.slice(index, index + batchSize));
  }

  return chunks;
};

const runDirect = (task) => task();

const metricSchema = (metrics) =>
  metrics
    .map((metric) => `      "${metric}": "<estimated ${metric}>"`)
    .join(',\n');

const priorityInstructions = `
Priority classification:
- P0 = Production blocker. Must be fixed before deployment.
- P1 = Must address before scaling. May not block the MVP, but must be addressed before significant growth.
- P2 = Should address during continued development. Include in the near-term development backlog.
- P3 = Acceptable MVP debt. Acceptable temporarily; monitor and revisit later.
`;

const buildDetectionPrompt = ({ domain, files, rule1 }) => `
You are a ${domain.detectionRole}.
Your task is to analyze the provided source code file(s) and detect ALL possible ${domain.issueNoun}s in each file.

IMPORTANT:
1. You MUST strictly follow all definitions and detection rules described in ${domain.rule1Name}.
2. This is a DETECTION phase:
   - Be INCLUSIVE (high recall)
   - You may include uncertain issues
   - Do NOT filter aggressively
3. Focus on: ${domain.detectionFocus}.
4. For each detected ${domain.issueNoun}:
   - Identify the ${domain.rawNameLabel}
   - Provide clear reasoning based on rules
   - Extract supporting evidence from code
   - Provide heuristic metrics when possible
5. DO NOT return final formatted JSON yet.
6. Return result as a RAW detection list in JSON format:
[
  {
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "${domain.rawNameField}": "<${domain.rawNameLabel}>",
    "category": "<category>",
    "title": "<short issue title>",
    "description": "<why this is detected>",
    "suggestion": "<specific, actionable fix suggestion for this exact issue in this exact file>",
    "evidence": "<code snippet or description>",
    "startLine": 1,
    "endLine": 1,
    "priority": "P0 | P1 | P2 | P3",
    "metrics": {
${metricSchema(domain.metrics)}
    }
  }
]
7. ${priorityInstructions}
8. The suggestion MUST be issue-specific:
   - Reference the exact issue and code context.
   - Explain what to change, where to start, and what to verify.
   - Do NOT return generic templates unless you also include the concrete remediation direction.
9. If no issues found, return:
[]

${domain.rule1Name}:
${rule1}

Now analyze each following file carefully.

${files
  .map(
    (file) => `
FILE NAME: ${getFileName(file.path)}
FILE PATH: ${file.path}
FILE SIZE: ${file.size} bytes

\`\`\`
${file.content}
\`\`\`
`,
  )
  .join('\n')}
`;

const buildValidationPrompt = ({ domain, rawDetections, rule2 }) => `
You are a ${domain.validationRole}.
Your task is to RE-EVALUATE the previously detected ${domain.issueNoun}s.
You MUST strictly follow ${domain.rule2Name}.

Input:
- A list of detected ${domain.issueNoun}s (RAW detection list from Phase 1)

Instructions:
1. This is a VALIDATION phase:
   - Focus on PRECISION (high precision)
   - Remove weak, incorrect, duplicate, or speculative issues
   - Keep only well-supported issues
2. For each detected issue:
   - Re-check against Rule 2 definitions
   - Validate evidence and reasoning
   - Re-evaluate metrics if needed
3. Filtering rules:
   - REMOVE issues with weak or unclear evidence
   - REMOVE issues that violate rule definitions
   - MERGE duplicated issues if they refer to the same weakness
4. Assign confidence level internally:
   - high -> strong evidence + clear rule match
   - medium -> partial match or borderline case
   - low -> weak evidence and should be removed
5. Improve explanation:
   - Make reasoning clear, structured, and precise
   - Preserve and improve the Phase 1 suggestion when it is useful
   - Add a concrete "suggestion" that tells the developer how to fix this exact issue
6. Focus while validating: ${domain.validationFocus}.
7. Output MUST follow FINAL JSON format:
[
  {
    "index": 1,
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "title": "<short readable issue title>",
    "description": "<clear validated explanation>",
    "suggestion": "<clear suggestion on how to fix this specific issue>",
    "startLine": 1,
    "endLine": 1,
    "priority": "P0 | P1 | P2 | P3",
    "priorityDisplay": "P0 – Production blocker | P1 – Must address before scaling | P2 – Should address during continued development | P3 – Acceptable MVP debt"
  }
]
8. Important:
   - DO NOT include issues with confidence = low
   - Ensure output is clean, consistent, and deduplicated
   - suggestion MUST be specific to the issue title, file, evidence, and line range
   - suggestion MUST NOT be a generic fallback sentence shared across unrelated issues
   - priority MUST use P0, P1, P2, or P3 based on production impact and urgency
9. If no valid issues remain:
[]

${domain.rule2Name}:
${rule2}

RAW DETECTION LIST:
${JSON.stringify(rawDetections, null, 2)}
`;

const shouldUseBatchFallback = (provider, error) =>
  provider === 'system_gemini' &&
  (error.statusCode >= 500 ||
    error.statusCode === 429 ||
    String(error.code || '').includes('GEMINI') ||
    String(error.code || '').includes('JSON_INVALID'));

const createDetectionBuckets = (files) =>
  new Map(files.map((file) => [file.path, []]));

const groupDetectionsByFile = (files, detections) => {
  const buckets = createDetectionBuckets(files);

  for (const detection of detections) {
    const filePath = String(detection.filePath || '');
    const fileName = String(detection.fileName || '');
    const matchedFile = files.find(
      (file) => file.path === filePath || getFileName(file.path) === fileName,
    );

    if (!matchedFile) {
      continue;
    }

    buckets.get(matchedFile.path).push({
      ...detection,
      fileName: getFileName(matchedFile.path),
      filePath: matchedFile.path,
    });
  }

  return buckets;
};

const fileHasDomainHint = (file, domain) => {
  const path = String(file.path || '').toLowerCase();
  return (domain.filePathHints || []).some((hint) =>
    path.includes(String(hint).toLowerCase()),
  );
};

const scoreFileForDomain = (file, domain) => {
  const path = String(file.path || '').toLowerCase();
  let score = file.priorityScore || 0;

  if (fileHasDomainHint(file, domain)) {
    score += 1_000;
  }

  if (/test|spec|stories|mock|fixture/.test(path)) {
    score -= 300;
  }

  return score;
};

const selectDomainFiles = (snippets, domain) => {
  const maxFiles = Number.isFinite(DOMAIN_MAX_FILES)
    ? Math.max(1, DOMAIN_MAX_FILES)
    : 50;
  const scoredFiles = snippets
    .map((file) => ({
      file,
      score: scoreFileForDomain(file, domain),
      hasDomainHint: fileHasDomainHint(file, domain),
    }))
    .sort((left, right) => right.score - left.score);
  const hintedFiles = scoredFiles.filter((item) => item.hasDomainHint);
  const selected = hintedFiles.length > 0 ? hintedFiles : scoredFiles;

  return selected.slice(0, maxFiles).map((item) => item.file);
};

const detectBatch = async ({
  domain,
  files,
  openAiApiKey,
  provider,
  rule1,
  runLimited,
}) => {
  try {
    const response = await runLimited(() =>
      callProviderJson({
        prompt: buildDetectionPrompt({ domain, files, rule1 }),
        provider,
        openAiApiKey,
        errorPrefix: `${domain.key.toUpperCase()}_DETECTION`,
      }),
    );

    return {
      cacheable: true,
      detections: ensureArrayResult(response.result),
      files,
      model: response.model,
    };
  } catch (error) {
    if (!shouldUseBatchFallback(provider, error)) {
      throw error;
    }

    return {
      cacheable: false,
      detections: fallbackDomainIssues({
        domainKey: domain.key,
        snippets: files,
      }),
      files,
      model: 'local-fallback-after-gemini-batch-failure',
    };
  }
};

const validateFindings = async ({
  domain,
  openAiApiKey,
  provider,
  rawDetections,
  rule2,
  runLimited,
}) => {
  try {
    const validation = await runLimited(() =>
      callProviderJson({
        prompt: buildValidationPrompt({ domain, rawDetections, rule2 }),
        provider,
        openAiApiKey,
        errorPrefix: `${domain.key.toUpperCase()}_VALIDATION`,
      }),
    );

    return {
      findings: normalizeFinalFindings(ensureArrayResult(validation.result), {
        type: domain.key,
      }),
      model: validation.model,
    };
  } catch (error) {
    if (!shouldUseBatchFallback(provider, error)) {
      throw error;
    }

    return {
      findings: normalizeFinalFindings(rawDetections, {
        type: domain.key,
      }),
      model: 'local-validation-fallback-after-gemini-failure',
    };
  }
};

export const analyzeDomain = async ({
  codeSample,
  domain,
  provider,
  openAiApiKey,
  runLimited = runDirect,
}) => {
  const [rule1, rule2] = await Promise.all([
    loadRuleFile(domain.rule1File),
    loadRuleFile(domain.rule2File),
  ]);
  const snippets = selectDomainFiles(codeSample.snippets, domain);
  const rawDetections = [];
  let model = null;
  const repositoryFullName = codeSample.repositoryFullName || 'unknown';
  const rulesHash = rulesContentHash(
    `${domain.key}-detection-priority-v1`,
    rule1,
  );
  const { cachedDetections, missingFiles } = await getCachedFileDetections({
    analysisType: domain.key,
    files: snippets,
    provider,
    repositoryFullName,
    rulesHash,
  });

  rawDetections.push(...cachedDetections);

  const batchResults = await Promise.all(
    chunkFiles(missingFiles).map((files) =>
      detectBatch({
        domain,
        files,
        openAiApiKey,
        provider,
        rule1,
        runLimited,
      }),
    ),
  );

  for (const result of batchResults) {
    const detectionsByFile = groupDetectionsByFile(
      result.files,
      result.detections,
    );
    const matchedDetections = [...detectionsByFile.values()].flat();

    model = result.model || model;
    rawDetections.push(...matchedDetections);

    if (!result.cacheable) {
      continue;
    }

    await saveFileDetectionsToCache({
      analysisType: domain.key,
      detectionsByFile,
      files: result.files,
      provider,
      repositoryFullName,
      rulesHash,
    });
  }

  if (rawDetections.length === 0) {
    return {
      model,
      findings: [],
    };
  }

  const validation = await validateFindings({
    domain,
    openAiApiKey,
    provider,
    rawDetections,
    rule2,
    runLimited,
  });

  return {
    model: validation.model || model,
    findings: validation.findings,
  };
};
