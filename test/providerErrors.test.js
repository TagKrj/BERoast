import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import errorMiddleware from '../src/middlewares/error.middleware.js';
import AppError from '../src/utils/appError.js';
import { callProviderJson } from '../src/services/analysis/llmClient.service.js';

const PROVIDER_BODY = '{"error":{"message":"internal provider detail"}}';

describe('provider error bodies', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    mock.method(console, 'error', () => {});
    mock.method(globalThis, 'fetch', async () =>
      new Response(PROVIDER_BODY, { status: 400 }),
    );
  });

  afterEach(() => {
    process.env = { ...original };
    mock.restoreAll();
  });

  for (const provider of ['system_gemini', 'user_openai']) {
    it(`${provider}: keeps the body out of the error and logs it`, async () => {
      const error = await callProviderJson({
        prompt: 'x',
        provider,
        openAiApiKey: 'sk-test',
        errorPrefix: 'TEST',
      }).catch((caught) => caught);

      assert.ok(error instanceof AppError);
      assert.doesNotMatch(error.message, /internal provider detail/);
      assert.match(
        console.error.mock.calls[0].arguments[0],
        /internal provider detail/,
      );
    });
  }
});

describe('errorMiddleware', () => {
  const run = (err) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    errorMiddleware(err, {}, res, () => {});
    return res;
  };

  beforeEach(() => {
    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('hides the message of a 500 and logs the error', () => {
    const res = run(new Error('db password in stack'));

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Server Error');
    assert.equal(console.error.mock.callCount(), 1);
  });

  it('returns an AppError message and code for client errors', () => {
    const res = run(new AppError('Nope.', 400, 'BAD_INPUT'));

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Nope.');
    assert.equal(res.body.error.code, 'BAD_INPUT');
    assert.equal(console.error.mock.callCount(), 0);
  });
});
