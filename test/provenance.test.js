import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { summarizeProvenance } from '../src/services/aiAnalysis.service.js';

const clean = {
  model: 'gemini-test',
  findings: [],
  provenance: {
    detectionBatches: 3,
    fallbackBatches: 0,
    validationFallback: false,
  },
};

describe('summarizeProvenance', () => {
  it('reports a clean domain as not degraded', () => {
    const { security } = summarizeProvenance({ security: clean });

    assert.equal(security.degraded, false);
    assert.equal(security.model, 'gemini-test');
  });

  it('flags a domain where some detection batches fell back', () => {
    const { security } = summarizeProvenance({
      security: {
        ...clean,
        provenance: { ...clean.provenance, fallbackBatches: 1 },
      },
    });

    assert.equal(security.degraded, true);
    assert.equal(security.fallbackBatches, 1);
  });

  it('flags a domain whose validation fell back', () => {
    const { robustness } = summarizeProvenance({
      robustness: {
        ...clean,
        provenance: { ...clean.provenance, validationFallback: true },
      },
    });

    assert.equal(robustness.degraded, true);
  });

  it('flags a whole-domain fallback and hides the fallback label as model', () => {
    const { architecture } = summarizeProvenance({
      architecture: {
        model: 'local-fallback-after-gemini-failure',
        findings: [],
        fallbackReason: 'ARCHITECTURE_DETECTION_GEMINI_FAILED',
        provenance: { domainFallback: true },
      },
    });

    assert.equal(architecture.degraded, true);
    assert.equal(architecture.model, null);
    assert.equal(
      architecture.fallbackReason,
      'ARCHITECTURE_DETECTION_GEMINI_FAILED',
    );
  });

  it('covers every domain even when an analysis is missing', () => {
    const summary = summarizeProvenance({});

    assert.deepEqual(Object.keys(summary).sort(), [
      'architecture',
      'interaction',
      'maintainability',
      'operational',
      'robustness',
      'security',
    ]);
    assert.equal(summary.security.degraded, false);
  });
});
