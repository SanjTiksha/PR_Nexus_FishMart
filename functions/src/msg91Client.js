'use strict';

const { MSG91_TIMEOUT_MS, MSG91_VERIFY_ACCESS_TOKEN_URL } = require('./config');

/**
 * POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 * Body: { authkey, "access-token" }
 *
 * Never logs authkey, access-token, or the MSG91 response.
 */
const verifyAccessToken = async ({
  authkey,
  accessToken,
  fetchImpl = fetch,
  timeoutMs = MSG91_TIMEOUT_MS,
}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(MSG91_VERIFY_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        authkey,
        'access-token': accessToken,
      }),
      signal: controller.signal,
    });

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return { kind: 'http', status: response.status, body };
  } catch {
    return { kind: 'network' };
  } finally {
    clearTimeout(timer);
  }
};

module.exports = {
  verifyAccessToken,
};
