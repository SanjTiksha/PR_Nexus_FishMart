'use strict';

/**
 * Isolated FishMart customer identifier helpers.
 *
 * MSG91 Verify Access Token trusted identifier is ONLY response.message.
 * FishMart customer login accepts Indian mobile only (not email).
 *
 * Never log the identifier.
 */

const isValidIndianMobile10 = (mobile10) =>
  /^[6-9]\d{9}$/.test(String(mobile10 || ''));

const normalizeIndianMobile10 = (input) => {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits;
};

const toE16491 = (mobile10) => `91${mobile10}`;

/** Deterministic Firebase UID. Same verified mobile always maps to the same UID. */
const toFirebaseUid = (mobile10) => `phone_${toE16491(mobile10)}`;

/**
 * Validate MSG91 `message` as an Indian mobile identifier.
 * Accepts documented 91XXXXXXXXXX and application 10-digit form.
 */
const parseVerifiedIndianMobile = (rawMessage) => {
  if (typeof rawMessage !== 'string') return { ok: false };
  const trimmed = rawMessage.trim();
  if (!trimmed) return { ok: false };
  if (trimmed.includes('@')) return { ok: false };

  const mobile10 = normalizeIndianMobile10(trimmed);
  if (!isValidIndianMobile10(mobile10)) return { ok: false };

  return {
    ok: true,
    mobile10,
    e16491: toE16491(mobile10),
    uid: toFirebaseUid(mobile10),
  };
};

module.exports = {
  isValidIndianMobile10,
  normalizeIndianMobile10,
  toE16491,
  toFirebaseUid,
  parseVerifiedIndianMobile,
};
