'use strict';

const { MAX_TOKEN_LENGTH } = require('./config');

/**
 * Client may send extra fields. mobile / mobileVerified / verifiedMobile are
 * never treated as proof of identity. Only a non-empty token string is accepted.
 */
const validateSessionRequest = (body) => {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false };
  }

  const token = body.token;
  if (typeof token !== 'string') {
    return { ok: false };
  }

  const trimmed = token.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH) {
    return { ok: false };
  }

  return { ok: true, token: trimmed };
};

module.exports = {
  validateSessionRequest,
};
