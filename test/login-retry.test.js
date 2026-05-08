import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isRetryableLoginError,
  loginRetryDelayMs,
  loginWithRetry
} from '../src/lib/login-retry.js';

test('isRetryableLoginError retries Discord 5xx and network failures', () => {
  assert.equal(isRetryableLoginError({ status: 503 }), true);
  assert.equal(isRetryableLoginError({ status: 429 }), true);
  assert.equal(isRetryableLoginError({ code: 'UND_ERR_CONNECT_TIMEOUT' }), true);
  assert.equal(isRetryableLoginError({ cause: { code: 'ETIMEDOUT' } }), true);
  assert.equal(isRetryableLoginError({ status: 401 }), false);
});

test('loginRetryDelayMs backs off up to the configured cap', () => {
  assert.equal(loginRetryDelayMs(1, { baseDelayMs: 1000, maxDelayMs: 5000 }), 1000);
  assert.equal(loginRetryDelayMs(3, { baseDelayMs: 1000, maxDelayMs: 5000 }), 4000);
  assert.equal(loginRetryDelayMs(4, { baseDelayMs: 1000, maxDelayMs: 5000 }), 5000);
});

test('loginWithRetry retries retryable login errors', async () => {
  const waits = [];
  const warnings = [];
  let attempts = 0;
  const client = {
    login: async () => {
      attempts += 1;

      if (attempts === 1) {
        const error = new Error('Service Unavailable');
        error.status = 503;
        throw error;
      }

      return 'logged-in';
    }
  };

  const result = await loginWithRetry(client, 'token', {
    baseDelayMs: 1000,
    logger: { warn: (message) => warnings.push(message) },
    maxAttempts: 2,
    wait: async (delayMs) => {
      waits.push(delayMs);
    }
  });

  assert.equal(result, 'logged-in');
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [1000]);
  assert.match(warnings[0], /status 503/);
});

test('loginWithRetry does not retry non-retryable login errors', async () => {
  let attempts = 0;
  const error = Object.assign(new Error('Unauthorized'), { status: 401 });
  const client = {
    login: async () => {
      attempts += 1;
      throw error;
    }
  };

  await assert.rejects(
    () => loginWithRetry(client, 'bad-token', {
      maxAttempts: 3,
      wait: async () => {}
    }),
    error
  );
  assert.equal(attempts, 1);
});
