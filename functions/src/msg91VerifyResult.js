'use strict';

/**
 * Isolated MSG91 verifyAccessToken response mapper.
 *
 * Confirmed request contract:
 *   POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 *   { "authkey": "<AuthKey>", "access-token": "<widget JWT>" }
 *
 * Success envelope used for Phase 1A.2:
 *   HTTP 2xx AND JSON object with type === "success"
 *   (`type` is MSG91's API outcome field, not a user identifier.)
 *
 * IDENTIFIER FIELD: PENDING CONFIRMATION.
 * Do not guess: mobile, identifier, email, message, token, accessToken,
 * "access-token", data.mobile, data.identifier, or similar.
 *
 * extractVerifiedIdentifier always fails closed. Phase 1A.2 must not return
 * an identifier to the client and must not mint a Firebase Custom Token.
 */

const isMsg91VerificationSuccess = (httpStatus, body) => {
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    return false;
  }
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }
  const type = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
  return type === 'success';
};

/**
 * Fail closed until MSG91 documents the verified-mobile / identifier field.
 * @returns {{ ok: false, reason: string }}
 */
const extractVerifiedIdentifier = (_body) => ({
  ok: false,
  reason:
    'MSG91 verified identifier field is pending confirmation. Fail closed.',
});

module.exports = {
  isMsg91VerificationSuccess,
  extractVerifiedIdentifier,
};
