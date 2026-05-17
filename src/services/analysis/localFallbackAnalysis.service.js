const getFileName = (filePath) => filePath.split('/').pop() || filePath;

const toLines = (content) => content.split(/\r?\n/);

const normalizeSnippet = (value, maxLength = 180) =>
  value.replace(/\s+/g, ' ').trim().slice(0, maxLength);

const findLine = (lines, matcher) => {
  const index = lines.findIndex(matcher);
  return index >= 0 ? index + 1 : 1;
};

const countNestingDepth = (content) => {
  let depth = 0;
  let maxDepth = 0;

  for (const char of content) {
    if (char === '{') {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }

    if (char === '}') {
      depth = Math.max(0, depth - 1);
    }
  }

  return maxDepth;
};

export const fallbackCodeSmells = (codeSample) => {
  const findings = [];

  for (const file of codeSample.snippets) {
    const lines = toLines(file.content);
    const nestingDepth = countNestingDepth(file.content);

    if (lines.length > 120) {
      findings.push({
        filePath: file.path,
        title: 'Large file with broad responsibility',
        description:
          'The file is large enough to make maintenance and review harder. Consider splitting unrelated responsibilities into smaller modules.',
        startLine: 1,
        endLine: lines.length,
        severity: lines.length > 250 ? 'high' : 'medium',
      });
    }

    if (nestingDepth >= 5) {
      findings.push({
        filePath: file.path,
        title: 'Deeply nested control flow',
        description:
          'The file contains deeply nested blocks, which increases cognitive load and makes edge cases harder to reason about.',
        startLine: findLine(lines, (line) =>
          /\b(if|for|while|switch)\b/.test(line),
        ),
        endLine: lines.length,
        severity: nestingDepth >= 7 ? 'high' : 'medium',
      });
    }

    const consoleLine = findLine(lines, (line) =>
      /\bconsole\.(log|debug|info)\b/.test(line),
    );
    if (
      consoleLine > 1 ||
      /\bconsole\.(log|debug|info)\b/.test(lines[0] || '')
    ) {
      findings.push({
        filePath: file.path,
        title: 'Debug logging left in source code',
        description:
          'Console logging in application code can create noise and may accidentally expose runtime data. Prefer structured logging behind environment controls.',
        startLine: consoleLine,
        endLine: consoleLine,
        severity: 'low',
      });
    }
  }

  return findings.slice(0, 30);
};

export const fallbackSecurityIssues = (codeSample) => {
  const findings = [];

  for (const file of codeSample.snippets) {
    const lines = toLines(file.content);
    const checks = [
      {
        pattern: /\b(eval|Function)\s*\(/,
        title: 'Dynamic code execution detected',
        description:
          'Dynamic code execution can lead to code injection if any part of the executed string is influenced by untrusted input.',
        severity: 'high',
      },
      {
        pattern: /\b(innerHTML|dangerouslySetInnerHTML)\b/,
        title: 'Unsafe HTML insertion pattern',
        description:
          'Raw HTML insertion can lead to cross-site scripting when rendered content includes untrusted data.',
        severity: 'high',
      },
      {
        pattern:
          /(password|token|secret|apiKey|apikey).*(console\.)|console\..*(password|token|secret|apiKey|apikey)/i,
        title: 'Sensitive value may be logged',
        description:
          'Logging passwords, tokens, secrets, or API keys can expose credentials through logs and monitoring systems.',
        severity: 'high',
      },
      {
        pattern: /(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{)/i,
        title: 'Query built with string interpolation or concatenation',
        description:
          'Constructing database queries with string concatenation or interpolation can lead to injection vulnerabilities.',
        severity: 'high',
      },
      {
        pattern: /\bfetch\s*\(\s*(req\.|request\.|ctx\.|params|query|body)/,
        title: 'Server-side request uses request-controlled input',
        description:
          'Fetching a URL derived from request input can create SSRF risk unless the destination is allowlisted and private networks are blocked.',
        severity: 'medium',
      },
    ];

    for (const check of checks) {
      const lineIndex = lines.findIndex((line) => check.pattern.test(line));
      if (lineIndex < 0) {
        continue;
      }

      findings.push({
        filePath: file.path,
        title: check.title,
        description: `${check.description} Evidence: ${normalizeSnippet(lines[lineIndex])}`,
        startLine: lineIndex + 1,
        endLine: lineIndex + 1,
        severity: check.severity,
      });
    }
  }

  return findings.slice(0, 30);
};
