import { callProviderJson } from './llmClient.service.js';
import {
  ensureArrayResult,
  normalizeFinalFindings,
} from './findingNormalizer.service.js';
import { loadRuleFile } from './ruleLoader.service.js';

const getFileName = (filePath) => filePath.split('/').pop() || filePath;
const DETECTION_BATCH_SIZE = Number.parseInt(
  process.env.ANALYSIS_DETECTION_BATCH_SIZE || '4',
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
7. If no smells found, return:
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
6. Output MUST follow FINAL JSON format:
[
  {
    "index": 1,
    "fileName": "<file name>",
    "filePath": "<relative file path>",
    "title": "<short readable issue title>",
    "description": "<clear validated explanation>",
    "startLine": 1,
    "endLine": 1,
    "severity": "low | medium | high",
    "severityDisplay": "Low | Medium | High"
  }
]
7. Important:
   - DO NOT include smells with confidence = low
   - Ensure output is clean, consistent, and deduplicated
8. If no valid smells remain:
[]

CODE_SMELL_RULE_2.md:
${rule2}

RAW DETECTION LIST:
${JSON.stringify(rawDetections, null, 2)}
`;

export const analyzeCodeSmells = async ({
  codeSample,
  provider,
  openAiApiKey,
}) => {
  const [rule1, rule2] = await Promise.all([
    loadRuleFile('CODE_SMELL_RULE_1.md'),
    loadRuleFile('CODE_SMELL_RULE_2.md'),
  ]);

  const rawDetections = [];
  let model = null;

  for (const files of chunkFiles(codeSample.snippets)) {
    const response = await callProviderJson({
      prompt: buildDetectionPrompt({ files, rule1 }),
      provider,
      openAiApiKey,
      errorPrefix: 'CODE_SMELL_DETECTION',
    });

    model = response.model;
    rawDetections.push(...ensureArrayResult(response.result));
  }

  if (rawDetections.length === 0) {
    return {
      model,
      findings: [],
    };
  }

  const validation = await callProviderJson({
    prompt: buildValidationPrompt({ rawDetections, rule2 }),
    provider,
    openAiApiKey,
    errorPrefix: 'CODE_SMELL_VALIDATION',
  });

  return {
    model: validation.model || model,
    findings: normalizeFinalFindings(ensureArrayResult(validation.result)),
  };
};
