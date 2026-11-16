import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDER_MISCONFIGURED,
  callProviderJson,
  isProviderConfigError,
} from '../src/services/analysis/llmClient.service.js';

const callGemini = () =>
  callProviderJson({
    prompt: 'x',
    provider: 'system_gemini',
    errorPrefix: 'TEST',
  });

describe('Gemini configuration errors', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_ANALYSIS_MODEL = 'retired-model';
    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    process.env = { ...original };
    mock.restoreAll();
  });

  it('reports a missing API key as misconfiguration', async () => {
    delete process.env.GEMINI_API_KEY;

    await assert.rejects(callGemini(), { code: PROVIDER_MISCONFIGURED });
  });

  for (const status of [401, 403, 404]) {
    it(`reports HTTP ${status} as misconfiguration and logs the model`, async () => {
      mock.method(globalThis, 'fetch', async () =>
        new Response('{"error":{"message":"provider detail"}}', { status }),
      );

      const error = await callGemini().catch((caught) => caught);

      assert.equal(isProviderConfigError(error), true);
      assert.equal(error.statusCode, 503);
      assert.doesNotMatch(error.message, /provider detail/);
      assert.match(console.error.mock.calls[0].arguments[0], /retired-model/);
    });
  }

  it('does not treat a transient 503 as misconfiguration', async () => {
    mock.method(globalThis, 'fetch', async () =>
      new Response('busy', { status: 503 }),
    );

    const error = await callGemini().catch((caught) => caught);

    assert.equal(isProviderConfigError(error), false);
  });
});
