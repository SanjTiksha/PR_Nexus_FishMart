/**
 * Isolated extraction of the MSG91 widget verifyOtp success payload token.
 *
 * MSG91 widget verifyOtp success callback payload candidates (priority order):
 *   1. data['access-token']  — primary field in current MSG91 widget versions
 *   2. data.accessToken      — alternate casing
 *   3. data.token            — alternate field name
 *   4. data.message          — legacy fallback (earlier widget versions)
 *
 * data.type is status metadata, never the token.
 *
 * Status strings ("success", "verified", "ok", "true", "done", "sent") and
 * values shorter than 20 characters are rejected — they are widget status
 * values, not JWT access tokens.
 *
 * This client token is NOT the server verifyAccessToken `message` field
 * (that server field is the verified mobile identifier).
 *
 * Never log the token. Never write it to localStorage or sessionStorage.
 * Never decode the JWT. Never read type, mobile, verifiedMobile, or the
 * browser mobile number as the token.
 */

const TOKEN_UNAVAILABLE = 'MSG91 verified token is not available.';

const STATUS_STRINGS = new Set(['success', 'verified', 'ok', 'true', 'done', 'sent']);
const MIN_TOKEN_LENGTH = 20;

const isLikelyToken = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < MIN_TOKEN_LENGTH) return false;
  if (STATUS_STRINGS.has(trimmed.toLowerCase())) return false;
  return true;
};

const extractFromConfirmedObject = (data) => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return '';
  }

  const candidates = [
    data['access-token'],
    data.accessToken,
    data.token,
    data.message,
  ];

  for (const candidate of candidates) {
    if (isLikelyToken(candidate)) return candidate.trim();
  }

  return '';
};

/**
 * @param {unknown} data - Raw MSG91 verifyOtp success callback argument
 * @returns {string} Verified client token string (in-memory only)
 */
export const extractMsg91VerifiedToken = (data) => {
  if (typeof data === 'string' && isLikelyToken(data)) {
    return data.trim();
  }

  const fromObject = extractFromConfirmedObject(data);
  if (fromObject) return fromObject;

  throw new Error(TOKEN_UNAVAILABLE);
};
