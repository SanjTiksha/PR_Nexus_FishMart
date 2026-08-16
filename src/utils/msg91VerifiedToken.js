/**
 * Isolated extraction of the MSG91 widget verifyOtp success payload token.
 *
 * MSG91 documents that success(data) contains the verified token.
 * The exact object property name is NOT confirmed in this repository.
 * Do not guess keys such as "access-token", "message", "token", or "accessToken".
 *
 * Never log the token. Never write it to localStorage or sessionStorage.
 * A raw-string callback is accepted in memory only. Do not use it for
 * Firebase authentication until the payload shape is confirmed.
 */

/**
 * @param {unknown} data - Raw MSG91 verifyOtp success callback argument
 * @returns {string} Verified token string (in-memory only)
 */
export const extractMsg91VerifiedToken = (data) => {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed) return trimmed;
  }

  throw new Error(
    'MSG91 verified token is not available. The success-response property is pending confirmation.',
  );
};
