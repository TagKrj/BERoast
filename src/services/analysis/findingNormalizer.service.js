const normalizeSeverity = (value) => {
  const severity = String(value || 'low').toLowerCase();
  return ['low', 'medium', 'high'].includes(severity) ? severity : 'low';
};

const normalizeLine = (value) => {
  const line = Number.parseInt(value, 10);
  return Number.isFinite(line) && line > 0 ? line : 1;
};

const defaultSuggestion = (item, type) => {
  if (type === 'security') {
    return `Fix the security weakness in ${item.filePath || 'the affected file'} by validating untrusted input, enforcing the relevant authorization or safety boundary, and replacing the risky pattern with a safer implementation. Add a regression test that proves the risky path is blocked.`;
  }

  return `Refactor ${item.filePath || 'the affected file'} around this issue by reducing the problematic structure, separating responsibilities where needed, and keeping the existing behavior covered by focused tests.`;
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
