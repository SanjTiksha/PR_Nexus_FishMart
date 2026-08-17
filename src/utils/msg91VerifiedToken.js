/**
 * Isolated extraction of the MSG91 widget verifyOtp success payload token.
 *
 * Confirmed client contract (live login capture):
 *   data is a non-null, non-array object
 *   data.message is the client verifyOtp JWT/access token (string)
 *   data.type is status metadata, not the token
 *
 * This client `message` is NOT the server verifyAccessToken `message`
 * (that server field is the verified mobile identifier).
 *
 * Never log the token. Never write it to localStorage or sessionStorage.
 * Never decode the JWT. Never read type, access-token, accessToken, token,
 * mobile, verifiedMobile, or the browser mobile number as the token.
 */

const TOKEN_UNAVAILABLE = 'MSG91 verified token is not available.';

const extractFromConfirmedObject = (data) => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return '';
  }

  if (typeof data.message !== 'string') {
    return '';
  }

  return data.message.trim();
};

/**
 * @param {unknown} data - Raw MSG91 verifyOtp success callback argument
 * @returns {string} Verified client token string (in-memory only)
 */
export const extractMsg91VerifiedToken = (data) => {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed) return trimmed;
  }

  const fromObject = extractFromConfirmedObject(data);
  if (fromObject) return fromObject;

  throw new Error(TOKEN_UNAVAILABLE);
};
