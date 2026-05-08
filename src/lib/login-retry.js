const RETRYABLE_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET'
]);

export async function loginWithRetry(client, token, options = {}) {
  const {
    baseDelayMs = 5000,
    logger = console,
    maxAttempts = Infinity,
    maxDelayMs = 60000,
    wait = delay
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await client.login(token);
    } catch (error) {
      if (!isRetryableLoginError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = loginRetryDelayMs(attempt, { baseDelayMs, maxDelayMs });
      logger.warn?.(`Discord login failed: ${loginErrorSummary(error)}. Retrying in ${formatDelay(delayMs)}.`);
      await wait(delayMs);
    }
  }

  return null;
}

export function isRetryableLoginError(error) {
  const status = Number(error?.status ?? error?.statusCode);

  if (status === 429 || status >= 500) {
    return true;
  }

  return RETRYABLE_ERROR_CODES.has(String(error?.code ?? error?.cause?.code ?? ''));
}

export function loginRetryDelayMs(attempt, options = {}) {
  const baseDelayMs = options.baseDelayMs ?? 5000;
  const maxDelayMs = options.maxDelayMs ?? 60000;

  return Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, attempt - 1)));
}

function loginErrorSummary(error) {
  const status = error?.status ?? error?.statusCode;
  const code = error?.code ?? error?.cause?.code;
  const parts = [
    status ? `status ${status}` : null,
    code ? `code ${code}` : null,
    error?.message
  ].filter(Boolean);

  return parts.join(', ') || String(error);
}

function formatDelay(delayMs) {
  return `${Math.round(delayMs / 1000)}s`;
}

function delay(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
