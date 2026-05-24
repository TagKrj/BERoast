const normalizeSeverity = (value) => {
  const severity = String(value || 'low').toLowerCase();
  return ['low', 'medium', 'high'].includes(severity) ? severity : 'low';
};

const normalizeLine = (value) => {
  const line = Number.parseInt(value, 10);
  return Number.isFinite(line) && line > 0 ? line : 1;
};

const contextualCodeSmellSuggestion = (item) => {
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();

  if (/large|god|broad responsibility|mixed|responsibilit/.test(text)) {
    return `Split the responsibilities in ${item.filePath || 'the affected file'} into smaller focused modules or functions. Start by extracting the data-fetching, state management, and rendering/business logic into separate units, then add regression tests for the behavior that was moved.`;
  }

  if (/nest|control flow|complex|cognitive/.test(text)) {
    return `Reduce the nested control flow in ${item.filePath || 'the affected file'} by extracting guard clauses and helper functions. Keep each branch focused on one decision, then add tests for the main edge cases covered by the nested logic.`;
  }

  if (/duplicate|duplication|repeated/.test(text)) {
    return `Extract the duplicated logic in ${item.filePath || 'the affected file'} into a shared helper or component with a clear name. Replace each repeated block with the shared abstraction and test one representative caller plus any important edge cases.`;
  }

  if (/naming|name|unclear/.test(text)) {
    return `Rename the unclear identifiers in ${item.filePath || 'the affected file'} so they describe the domain concept or behavior they represent. Update the surrounding code and tests together so the intent is clear without extra comments.`;
  }

  if (/state|props|component/.test(text)) {
    return `Simplify the component structure in ${item.filePath || 'the affected file'} by moving derived state, side effects, or child-specific logic into smaller hooks/components. Keep the parent focused on orchestration and verify the UI behavior after the split.`;
  }

  if (/log|console|debug/.test(text)) {
    return `Replace the debug logging in ${item.filePath || 'the affected file'} with structured logging behind an environment flag, or remove it if it is not needed. Make sure sensitive runtime values are not printed.`;
  }

  return `Refactor the exact issue described in ${item.filePath || 'the affected file'} rather than applying a broad rewrite. Use the issue title and description to isolate the problematic block, make the smallest behavior-preserving change, and add a focused verification for that behavior.`;
};

const contextualSecuritySuggestion = (item) => {
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();

  if (/eval|dynamic code|function constructor/.test(text)) {
    return `Remove dynamic code execution from ${item.filePath || 'the affected file'}. Replace eval/Function-style behavior with an explicit allowlisted command map or parser, and add tests proving untrusted input cannot execute arbitrary code.`;
  }

  if (/xss|html|innerhtml|dangerouslysetinnerhtml/.test(text)) {
    return `Sanitize or avoid raw HTML rendering in ${item.filePath || 'the affected file'}. Prefer safe text rendering; if HTML is required, sanitize with a trusted sanitizer and test that script/event-handler payloads are neutralized.`;
  }

  if (/secret|token|password|credential|logged/.test(text)) {
    return `Stop exposing sensitive values in ${item.filePath || 'the affected file'}. Remove the log/output path, redact secrets before logging, and add a regression check that tokens, passwords, and API keys are never emitted.`;
  }

  if (/sql|query|injection|interpolation|concatenation/.test(text)) {
    return `Replace the string-built query in ${item.filePath || 'the affected file'} with parameterized queries or the database driver's safe query builder. Add tests with malicious input to confirm it is treated as data, not executable query text.`;
  }

  if (/ssrf|server-side request|fetch|request-controlled/.test(text)) {
    return `Validate outbound request targets in ${item.filePath || 'the affected file'} with a strict allowlist, block private/internal network ranges, and normalize URLs before fetching. Add tests for rejected localhost, metadata, and private IP destinations.`;
  }

  if (/auth|authorization|permission|access control/.test(text)) {
    return `Enforce the missing authorization boundary in ${item.filePath || 'the affected file'} before accessing protected data or actions. Check the authenticated user, ownership/role, and denial paths with regression tests.`;
  }

  return `Fix the concrete security weakness described in ${item.filePath || 'the affected file'} by validating untrusted input, enforcing the relevant trust boundary, and replacing the risky pattern with a safer implementation. Add a regression test for the attack path described in the finding.`;
};

const defaultSuggestion = (item, type) => {
  if (type === 'security') {
    return contextualSecuritySuggestion(item);
  }

  return contextualCodeSmellSuggestion(item);
};

const normalizeSuggestion = (item, type) => {
  const value =
    item.suggestion ||
    item.fixSuggestion ||
    item.recommendation ||
    item.howToFix ||
    item.remediation;

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return defaultSuggestion(item, type);
};

export const normalizeFinalFindings = (items = [], { type } = {}) =>
  items.slice(0, 80).map((item, index) => {
    const startLine = normalizeLine(item.startLine);
    const endLine = Math.max(startLine, normalizeLine(item.endLine));
    const severity = normalizeSeverity(item.severity);

    return {
      filePath: String(item.filePath || 'unknown'),
      title: String(item.title || 'Untitled issue'),
      description: String(item.description || 'No description provided.'),
      suggestion: normalizeSuggestion(item, type),
      startLine,
      endLine,
      severity,
      ruleId: item.ruleId ? String(item.ruleId) : null,
      confidence:
        typeof item.confidence === 'number'
          ? Math.max(0, Math.min(1, item.confidence))
          : null,
      sourceIndex: Number.isFinite(Number(item.index))
        ? Number(item.index)
        : index + 1,
    };
  });

export const ensureArrayResult = (result) => {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.items)) {
    return result.items;
  }

  if (Array.isArray(result?.findings)) {
    return result.findings;
  }

  return [];
};
