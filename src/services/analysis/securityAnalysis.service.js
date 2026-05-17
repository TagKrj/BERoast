import { callProviderJson } from './llmClient.service.js';
import {
  ensureArrayResult,
  normalizeFinalFindings,
} from './findingNormalizer.service.js';
import { loadRuleFile } from './ruleLoader.service.js';

const getFileName = (filePath) => filePath.split('/').pop() || filePath;
const DETECTION_BATCH_SIZE = Number.parseInt(
  process.env.ANALYSIS_DETECTION_BATCH_SIZE || '8',
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
   - DO NOT include issues with confidence = low
   - Ensure output is clean, consistent, and deduplicated
8. If no valid security issues remain:
[]

SECURITY_RULE_2.md:
${rule2}

RAW DETECTION LIST:
${JSON.stringify(rawDetections, null, 2)}
`;

export const analyzeSecurityIssues = async ({
  codeSample,
  provider,
  openAiApiKey,
}) => {
  const [rule1, rule2] = await Promise.all([
    loadRuleFile('SECURITY_RULE_1.md'),
    loadRuleFile('SECURITY_RULE_2.md'),
  ]);

  const rawDetections = [];
  let model = null;

  for (const files of chunkFiles(codeSample.snippets)) {
    const response = await callProviderJson({
      prompt: buildDetectionPrompt({ files, rule1 }),
      provider,
      openAiApiKey,
      errorPrefix: 'SECURITY_DETECTION',
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
    errorPrefix: 'SECURITY_VALIDATION',
  });

  return {
    model: validation.model || model,
    findings: normalizeFinalFindings(ensureArrayResult(validation.result)),
  };
};
