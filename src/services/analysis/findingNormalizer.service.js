const normalizeSeverity = (value) => {
  const severity = String(value || 'low').toLowerCase();
  return ['low', 'medium', 'high'].includes(severity) ? severity : 'low';
};

const normalizeLine = (value) => {
  const line = Number.parseInt(value, 10);
  return Number.isFinite(line) && line > 0 ? line : 1;
};

export const normalizeFinalFindings = (items = []) =>
  items.slice(0, 80).map((item, index) => {
    const startLine = normalizeLine(item.startLine);
    const endLine = Math.max(startLine, normalizeLine(item.endLine));
    const severity = normalizeSeverity(item.severity);

    return {
      filePath: String(item.filePath || 'unknown'),
      title: String(item.title || 'Untitled issue'),
      description: String(item.description || 'No description provided.'),
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
