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
        suggestion:
          'Split the large file into smaller modules grouped by responsibility. Extract independent helpers, data access, and UI/business logic first, then add regression tests around the behavior that moved.',
        startLine: 1,
        endLine: lines.length,
        priority: lines.length > 250 ? 'p1' : 'p2',
      });
    }

    if (nestingDepth >= 5) {
      findings.push({
        filePath: file.path,
        title: 'Deeply nested control flow',
        description:
          'The file contains deeply nested blocks, which increases cognitive load and makes edge cases harder to reason about.',
        suggestion:
          'Replace nested branches with guard clauses and extract complex decision blocks into named helper functions. Cover the main branches with tests before and after the refactor.',
        startLine: findLine(lines, (line) =>
          /\b(if|for|while|switch)\b/.test(line),
        ),
        endLine: lines.length,
        priority: nestingDepth >= 7 ? 'p1' : 'p2',
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
        suggestion:
          'Remove the debug log or replace it with structured logging controlled by environment level. Avoid logging request data, tokens, secrets, or user-sensitive values.',
        startLine: consoleLine,
        endLine: consoleLine,
        priority: 'p3',
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
        suggestion:
          'Remove eval/Function usage and replace it with an explicit allowlisted command map or parser. Add tests proving untrusted input cannot execute arbitrary code.',
        priority: 'p0',
      },
      {
        pattern: /\b(innerHTML|dangerouslySetInnerHTML)\b/,
        title: 'Unsafe HTML insertion pattern',
        description:
          'Raw HTML insertion can lead to cross-site scripting when rendered content includes untrusted data.',
        suggestion:
          'Avoid raw HTML insertion for untrusted content. Render text safely, or sanitize HTML with a trusted sanitizer and test script/event-handler payloads.',
        priority: 'p0',
      },
      {
        pattern:
          /(password|token|secret|apiKey|apikey).*(console\.)|console\..*(password|token|secret|apiKey|apikey)/i,
        title: 'Sensitive value may be logged',
        description:
          'Logging passwords, tokens, secrets, or API keys can expose credentials through logs and monitoring systems.',
        suggestion:
          'Remove the sensitive log path or redact secrets before logging. Add a regression check that tokens, passwords, secrets, and API keys are never emitted.',
        priority: 'p0',
      },
      {
        pattern: /(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{)/i,
        title: 'Query built with string interpolation or concatenation',
        description:
          'Constructing database queries with string concatenation or interpolation can lead to injection vulnerabilities.',
        suggestion:
          'Use parameterized queries or the database driver safe query builder instead of string concatenation. Test malicious input to confirm it is treated as data.',
        priority: 'p0',
      },
      {
        pattern: /\bfetch\s*\(\s*(req\.|request\.|ctx\.|params|query|body)/,
        title: 'Server-side request uses request-controlled input',
        description:
          'Fetching a URL derived from request input can create SSRF risk unless the destination is allowlisted and private networks are blocked.',
        suggestion:
          'Normalize and validate outbound URLs with a strict allowlist, block localhost/private network ranges, and test rejected internal destinations.',
        priority: 'p1',
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
        suggestion: check.suggestion,
        startLine: lineIndex + 1,
        endLine: lineIndex + 1,
        priority: check.priority,
      });
    }
  }

  return findings.slice(0, 30);
};

export const fallbackDomainIssues = ({ domainKey, snippets = [] }) => {
  if (domainKey === 'maintainability') {
    return fallbackCodeSmells({ snippets });
  }

  if (domainKey === 'security') {
    return fallbackSecurityIssues({ snippets });
  }

  const findings = [];

  for (const file of snippets) {
    const lines = toLines(file.content);
    const filePath = file.path || '';
    const content = file.content;

    if (
      domainKey === 'architecture' &&
      /controller|route|component|page|service/i.test(filePath) &&
      lines.length > 180
    ) {
      findings.push({
        filePath,
        title: 'Large module may blur architecture boundaries',
        description:
          'The file is large and sits in an architectural boundary area, which may indicate mixed responsibilities or unclear module separation.',
        suggestion:
          'Review the responsibilities in this module and split routing, orchestration, data access, and presentation concerns into clearer layers before adding more features.',
        startLine: 1,
        endLine: lines.length,
        priority: 'p2',
      });
    }

    if (
      domainKey === 'robustness' &&
      /\b(await|fetch|axios|then\s*\()\b/.test(content) &&
      !/\btry\s*{|\.catch\s*\(/.test(content)
    ) {
      findings.push({
        filePath,
        title: 'Async operation lacks explicit failure handling',
        description:
          'The file appears to perform asynchronous work without a nearby try/catch or catch handler, which can make runtime failures harder to recover from.',
        suggestion:
          'Wrap the async boundary with explicit error handling, return a predictable error state, and add a test or manual check for the failure path.',
        startLine: findLine(lines, (line) =>
          /\b(await|fetch|axios)\b/.test(line),
        ),
        endLine: lines.length,
        priority: 'p2',
      });
    }

    if (
      domainKey === 'operational' &&
      /app\.use|cors|rateLimit|listen|process\.env|Dockerfile|workflow|deploy/i.test(
        content + filePath,
      )
    ) {
      const hasOperationalGuard =
        /helmet|rateLimit|health|process\.env|cors/i.test(content);

      if (!hasOperationalGuard) {
        findings.push({
          filePath,
          title: 'Operational safeguards may be incomplete',
          description:
            'The file appears to participate in runtime or deployment behavior but does not show clear health, config, rate limit, or safety controls.',
          suggestion:
            'Add explicit runtime safeguards such as health checks, environment validation, rate limits, and safe configuration defaults where this module controls deployment or server behavior.',
          startLine: 1,
          endLine: Math.min(lines.length, 40),
          priority: 'p2',
        });
      }
    }

    if (
      domainKey === 'interaction' &&
      /component|page|form|hook|service/i.test(filePath) &&
      /\b(fetch|axios|submit|onClick|loading|error)\b/i.test(content)
    ) {
      const hasFeedback =
        /\b(loading|isLoading|error|toast|alert|disabled)\b/i.test(content);

      if (!hasFeedback) {
        findings.push({
          filePath,
          title: 'User interaction may lack visible feedback',
          description:
            'The file appears to handle a user or API interaction but does not show clear loading, disabled, or error feedback states.',
          suggestion:
            'Add visible loading and error states around the interaction, disable repeated submit actions while pending, and verify the user sees a clear outcome for success and failure.',
          startLine: findLine(lines, (line) =>
            /\b(fetch|axios|submit|onClick)\b/i.test(line),
          ),
          endLine: lines.length,
          priority: 'p2',
        });
      }
    }
  }

  return findings.slice(0, 20);
};
