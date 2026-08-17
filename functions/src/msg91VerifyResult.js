'use strict';

/**
 * Isolated MSG91 verifyAccessToken response mapper.
 *
 * Confirmed request contract:
 *   POST .../api/v5/widget/verifyAccessToken
 *   { "authkey": "<AuthKey>", "access-token": "<widget JWT>" }
 *
 * Confirmed success sample (official MSG91 docs):
 *   { "type": "success", "message": "919999999999" }
 *
 * Trusted identifier JSON path: message
 * Do not use: mobile, identifier, data.mobile, JWT claims, browser mobile.
 */

const { parseVerifiedIndianMobile } = require('./customerIdentifier');

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
 * Read ONLY body.message. Fail closed if missing, empty, or not an Indian mobile.
 */
const extractVerifiedIdentifier = (body) => {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false };
  }
  if (typeof body.message !== 'string') {
    return { ok: false };
  }
  return parseVerifiedIndianMobile(body.message);
};

module.exports = {
  isMsg91VerificationSuccess,
  extractVerifiedIdentifier,
};
