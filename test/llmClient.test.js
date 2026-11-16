import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseJsonResponse,
  resolveProviderModel,
} from '../src/services/analysis/llmClient.service.js';

describe('parseJsonResponse', () => {
  it('parses plain and fenced JSON', () => {
    assert.deepEqual(parseJsonResponse('{"a":1}', 'X'), { a: 1 });
    assert.deepEqual(parseJsonResponse('```json\n[1,2]\n```', 'X'), [1, 2]);
  });

  it('throws a 502 AppError with the given code on invalid JSON', () => {
    assert.throws(() => parseJsonResponse('not json', 'TEST_JSON_INVALID'), {
      statusCode: 502,
      code: 'TEST_JSON_INVALID',
    });
  });
});

describe('resolveProviderModel', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('uses the configured model per provider', () => {
    process.env.GEMINI_ANALYSIS_MODEL = 'gemini-test';
    process.env.OPENAI_ANALYSIS_MODEL = 'openai-test';

    assert.equal(resolveProviderModel('system_gemini'), 'gemini-test');
    assert.equal(resolveProviderModel('user_openai'), 'openai-test');
  });
});
