'use strict';

const { MAX_TOKEN_LENGTH } = require('./config');

const VALID_INTENTS = new Set(['checkout', 'session']);

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

  let intent = 'session';
  if (Object.prototype.hasOwnProperty.call(body, 'intent')) {
    if (typeof body.intent !== 'string') {
      return { ok: false };
    }
    const trimmedIntent = body.intent.trim();
    if (!VALID_INTENTS.has(trimmedIntent)) {
      return { ok: false };
    }
    intent = trimmedIntent;
  }

  return { ok: true, token: trimmed, intent };
};

module.exports = {
  validateSessionRequest,
};
