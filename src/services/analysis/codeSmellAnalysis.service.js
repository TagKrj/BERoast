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
import { fallbackCodeSmells } from './localFallbackAnalysis.service.js';
import { loadRuleFile } from './ruleLoader.service.js';

const getFileName = (filePath) => filePath.split('/').pop() || filePath;
const ANALYSIS_TYPE = 'code_smell';
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
You are a senior software engineer specializing in static code analysis and code smell detection.
Your task is to analyze the provided source code file(s) and detect ALL possible code smells in each file.

IMPORTANT:
1. You MUST strictly follow all definitions and detection rules described in CODE_SMELL_RULE_1.md.
2. This is a DETECTION phase:
   - Be INCLUSIVE (high recall)
   - You may include uncertain smells
   - Do NOT filter aggressively
3. For each detected code smell:
   - Identify the smell name
   - Provide clear reasoning based on rules
   - Extract supporting evidence from code
   - Provide heuristic metrics when possible
4. Metrics are ESTIMATIONS, including:
   - method_length
   - class_size
   - nesting_depth
   - external_dependency_ratio
   - duplication_signals
5. DO NOT return final formatted JSON yet.
6. Return result as a RAW detection list in JSON format:
[
  {
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "smell": "<smell name>",
    "category": "<category>",
    "title": "<short issue title>",
    "description": "<why this is detected>",
    "suggestion": "<specific, actionable fix suggestion for this exact smell in this exact file>",
    "evidence": "<code snippet or description>",
    "startLine": 1,
    "endLine": 1,
    "severity": "low | medium | high",
    "metrics": {
      "method_length": "short | medium | long",
      "class_size": "small | medium | large",
      "nesting_depth": "shallow | medium | deep",
      "external_dependency_ratio": "low | medium | high",
      "duplication_signals": "yes | no"
    }
  }
]
7. The suggestion MUST be issue-specific:
   - Reference the exact smell and code context.
   - Explain what to change, where to start, and what to verify.
   - Do NOT return generic templates such as "refactor this file" unless you also include the concrete refactor direction.
8. If no smells found, return:
[]

CODE_SMELL_RULE_1.md:
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
You are an expert in software quality and code smell validation.
Your task is to RE-EVALUATE the previously detected code smells.
You MUST strictly follow CODE_SMELL_RULE_2.md.

Input:
- A list of detected code smells (RAW detection list from Phase 1)

Instructions:
1. This is a VALIDATION phase:
   - Focus on PRECISION (high precision)
   - Remove weak, incorrect, or duplicate smells
   - Keep only well-supported smells
2. For each detected smell:
   - Re-check against Rule 2 definitions
   - Validate evidence and reasoning
   - Re-evaluate metrics if needed
3. Filtering rules:
   - REMOVE smells with weak or unclear evidence
   - REMOVE smells that violate rule definitions
   - MERGE duplicated smells if they refer to the same issue
4. Assign confidence level internally:
   - high -> strong evidence + clear rule match
   - medium -> partial match or borderline case
   - low -> weak evidence and should be removed
5. Improve explanation:
   - Make reasoning clear, structured, and precise
   - Preserve and improve the Phase 1 suggestion when it is useful
   - Add a concrete "suggestion" that tells the developer how to fix this exact smell
6. Output MUST follow FINAL JSON format:
[
  {
    "index": 1,
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "title": "<short readable issue title>",
    "description": "<clear validated explanation>",
    "suggestion": "<clear suggestion on how to fix this specific code smell>",
    "startLine": 1,
    "endLine": 1,
    "severity": "low | medium | high",
    "severityDisplay": "Low | Medium | High"
  }
]
7. Important:
   - DO NOT include smells with confidence = low
   - Ensure output is clean, consistent, and deduplicated
   - suggestion MUST be specific to the issue title, file, evidence, and line range
   - suggestion MUST NOT be a generic fallback sentence shared across unrelated smells
8. If no valid smells remain:
[]

CODE_SMELL_RULE_2.md:
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
        errorPrefix: 'CODE_SMELL_DETECTION',
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
      detections: fallbackCodeSmells({ snippets: files }),
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
        errorPrefix: 'CODE_SMELL_VALIDATION',
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

export const analyzeCodeSmells = async ({
  codeSample,
  provider,
  openAiApiKey,
  runLimited = runDirect,
}) => {
  const [rule1, rule2] = await Promise.all([
    loadRuleFile('CODE_SMELL_RULE_1.md'),
    loadRuleFile('CODE_SMELL_RULE_2.md'),
  ]);

  const rawDetections = [];
  let model = null;
  const repositoryFullName = codeSample.repositoryFullName || 'unknown';
  const rulesHash = rulesContentHash(
    'code-smell-detection-suggestion-v2',
    rule1,
  );
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
