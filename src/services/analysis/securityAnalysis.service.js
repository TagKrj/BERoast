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
import { fallbackSecurityIssues } from './localFallbackAnalysis.service.js';
import { loadRuleFile } from './ruleLoader.service.js';

const getFileName = (filePath) => filePath.split('/').pop() || filePath;
const ANALYSIS_TYPE = 'security';
const DETECTION_BATCH_SIZE = Number.parseInt(
  process.env.ANALYSIS_DETECTION_BATCH_SIZE || '3',
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

const buildDetectionPrompt = ({ files, rule1 }) => `
You are a senior application security engineer specializing in static security analysis.
Your task is to analyze the provided source code file(s) and detect ALL possible security issues in each file.

IMPORTANT:
1. You MUST strictly follow all definitions and detection rules described in SECURITY_RULE_1.md.
2. This is a DETECTION phase:
   - Be INCLUSIVE (high recall)
   - You may include uncertain security issues
   - Do NOT filter aggressively
3. For each detected security issue:
   - Identify the vulnerability name
   - Provide clear reasoning based on rules
   - Extract supporting evidence from code
   - Provide heuristic metrics when possible
4. Metrics are ESTIMATIONS, including:
   - tainted_input_flow
   - auth_boundary
   - validation_strength
   - dangerous_api_usage
   - sensitive_data_exposure
5. DO NOT return final formatted JSON yet.
6. Return result as a RAW detection list in JSON format:
[
  {
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "vulnerability": "<vulnerability name>",
    "category": "<category>",
    "title": "<short issue title>",
    "description": "<why this is detected>",
    "evidence": "<code snippet or description>",
    "startLine": 1,
    "endLine": 1,
    "severity": "low | medium | high",
    "metrics": {
      "tainted_input_flow": "none | possible | clear",
      "auth_boundary": "none | partial | strong",
      "validation_strength": "none | weak | strong",
      "dangerous_api_usage": "none | possible | clear",
      "sensitive_data_exposure": "none | possible | clear"
    }
  }
]
7. If no security issues found, return:
[]

SECURITY_RULE_1.md:
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

const buildValidationPrompt = ({ rawDetections, rule2 }) => `
You are an expert in application security validation.
Your task is to RE-EVALUATE the previously detected security issues.
You MUST strictly follow SECURITY_RULE_2.md.

Input:
- A list of detected security issues (RAW detection list from Phase 1)

Instructions:
1. This is a VALIDATION phase:
   - Focus on PRECISION (high precision)
   - Remove weak, incorrect, duplicate, or purely speculative security issues
   - Keep only well-supported issues
2. For each detected issue:
   - Re-check against Rule 2 definitions
   - Validate evidence and exploitability
   - Re-evaluate metrics if needed
3. Filtering rules:
   - REMOVE issues with weak or unclear evidence
   - REMOVE issues that violate rule definitions
   - REMOVE test-only concerns unless they clearly affect production behavior
   - MERGE duplicated issues if they refer to the same weakness
4. Assign confidence level internally:
   - high -> strong evidence + clear rule match + realistic impact
   - medium -> partial match or context-dependent issue
   - low -> weak evidence and should be removed
5. Improve explanation:
   - Make reasoning clear, structured, and precise
   - Add a concrete "suggestion" that tells the developer how to fix this exact security issue
6. Output MUST follow FINAL JSON format:
[
  {
    "index": 1,
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "title": "<short readable issue title>",
    "description": "<clear validated explanation>",
    "suggestion": "<clear suggestion on how to fix this specific security issue>",
    "startLine": 1,
    "endLine": 1,
    "severity": "low | medium | high",
    "severityDisplay": "Low | Medium | High"
  }
]
7. Important:
   - DO NOT include issues with confidence = low
   - Ensure output is clean, consistent, and deduplicated
8. If no valid security issues remain:
[]

SECURITY_RULE_2.md:
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

const runDirect = (task) => task();

const detectBatch = async ({
  files,
  openAiApiKey,
  provider,
  rule1,
  runLimited,
}) => {
  try {
    const response = await runLimited(() =>
      callProviderJson({
        prompt: buildDetectionPrompt({ files, rule1 }),
        provider,
        openAiApiKey,
        errorPrefix: 'SECURITY_DETECTION',
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
      detections: fallbackSecurityIssues({ snippets: files }),
      files,
      model: 'local-fallback-after-gemini-batch-failure',
    };
  }
};

const validateFindings = async ({
  openAiApiKey,
  provider,
  rawDetections,
  rule2,
  runLimited,
}) => {
  try {
    const validation = await runLimited(() =>
      callProviderJson({
        prompt: buildValidationPrompt({ rawDetections, rule2 }),
        provider,
        openAiApiKey,
        errorPrefix: 'SECURITY_VALIDATION',
      }),
    );

    return {
      findings: normalizeFinalFindings(ensureArrayResult(validation.result), {
        type: ANALYSIS_TYPE,
      }),
      model: validation.model,
    };
  } catch (error) {
    if (!shouldUseBatchFallback(provider, error)) {
      throw error;
    }

    return {
      findings: normalizeFinalFindings(rawDetections, {
        type: ANALYSIS_TYPE,
      }),
      model: 'local-validation-fallback-after-gemini-failure',
    };
  }
};

export const analyzeSecurityIssues = async ({
  codeSample,
  provider,
  openAiApiKey,
  runLimited = runDirect,
}) => {
  const [rule1, rule2] = await Promise.all([
    loadRuleFile('SECURITY_RULE_1.md'),
    loadRuleFile('SECURITY_RULE_2.md'),
  ]);

  const rawDetections = [];
  let model = null;
  const repositoryFullName = codeSample.repositoryFullName || 'unknown';
  const rulesHash = rulesContentHash(rule1);
  const { cachedDetections, missingFiles } = await getCachedFileDetections({
    analysisType: ANALYSIS_TYPE,
    files: codeSample.snippets,
    provider,
    repositoryFullName,
    rulesHash,
  });

  rawDetections.push(...cachedDetections);

  const batchResults = await Promise.all(
    chunkFiles(missingFiles).map((files) =>
      detectBatch({
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
      analysisType: ANALYSIS_TYPE,
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
