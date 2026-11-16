import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureArrayResult,
  normalizeFinalFindings,
  normalizePriority,
} from '../src/services/analysis/findingNormalizer.service.js';

describe('normalizePriority', () => {
  it('accepts P0-P3 in any case and with a prefix', () => {
    assert.equal(normalizePriority('P0'), 'p0');
    assert.equal(normalizePriority('p2'), 'p2');
    assert.equal(normalizePriority('Priority P1'), 'p1');
  });

  it('maps legacy severities', () => {
    assert.equal(normalizePriority(undefined, 'high'), 'p1');
    assert.equal(normalizePriority(undefined, 'Medium'), 'p2');
    assert.equal(normalizePriority('low'), 'p3');
  });

  it('defaults to p3', () => {
    assert.equal(normalizePriority(undefined), 'p3');
    assert.equal(normalizePriority('whatever'), 'p3');
  });

  // Current behaviour, arguably wrong: "critical" lands on the lowest priority.
  it('maps "critical" to p3', () => {
    assert.equal(normalizePriority(undefined, 'critical'), 'p3');
  });
});

describe('normalizeFinalFindings', () => {
  it('fills defaults for missing fields', () => {
    const [finding] = normalizeFinalFindings([{}], { type: 'security' });

    assert.equal(finding.filePath, 'unknown');
    assert.equal(finding.title, 'Untitled issue');
    assert.equal(finding.priority, 'p3');
    assert.equal(finding.confidence, null);
    assert.equal(finding.sourceIndex, 1);
  });

  it('keeps endLine at or after startLine and clamps confidence', () => {
    const [finding] = normalizeFinalFindings(
      [{ startLine: 20, endLine: 5, confidence: 1.7, priority: 'P0' }],
      { type: 'security' },
    );

    assert.equal(finding.startLine, 20);
    assert.equal(finding.endLine, 20);
    assert.equal(finding.confidence, 1);
    assert.equal(finding.priority, 'p0');
  });

  it('caps the list at 80 findings', () => {
    const items = Array.from({ length: 100 }, () => ({}));
    assert.equal(
      normalizeFinalFindings(items, { type: 'robustness' }).length,
      80,
    );
  });
});

describe('ensureArrayResult', () => {
  it('unwraps the shapes models return', () => {
    assert.deepEqual(ensureArrayResult([1]), [1]);
    assert.deepEqual(ensureArrayResult({ items: [2] }), [2]);
    assert.deepEqual(ensureArrayResult({ findings: [3] }), [3]);
    assert.deepEqual(ensureArrayResult({ other: [4] }), []);
    assert.deepEqual(ensureArrayResult(null), []);
  });
});
