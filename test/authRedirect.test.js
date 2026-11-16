import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildFrontendRedirectUrl } from '../src/controllers/auth.controller.js';

const redirect = (state) =>
  new URL(
    buildFrontendRedirectUrl({
      accessToken: 'token',
      requestOrigin: 'http://localhost:5001',
      state,
      user: { id: 'u1' },
    }),
  );

describe('buildFrontendRedirectUrl', () => {
  it('passes the OAuth state back to the frontend', () => {
    assert.equal(redirect('nonce-123').searchParams.get('state'), 'nonce-123');
  });

  it('omits state when GitHub returned none', () => {
    assert.equal(redirect(undefined).searchParams.has('state'), false);
  });
});
