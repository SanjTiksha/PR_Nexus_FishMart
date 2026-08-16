/**
 * Isolated extraction of the MSG91 widget verifyOtp success payload token.
 *
 * MSG91 documents that success(data) contains the verified token.
 * The exact object property name is NOT confirmed in this repository.
 * Do not guess keys such as "access-token", "message", "token", or "accessToken".
 *
 * Never log the token. Never write it to localStorage or sessionStorage.
 */

/**
 * Pending confirmation. Assign a key string or nested-key array only after
 * the MSG91 success(data) property is confirmed in implementation testing.
 * Leave null until then — extraction will fail safely for object payloads.
 */
let verifiedTokenPath = null;

export const getMsg91VerifiedTokenPath = () => verifiedTokenPath;

/** Configure the extraction path later without rewriting call sites. */
export const setMsg91VerifiedTokenPath = (path) => {
  if (path == null || path === '') {
    verifiedTokenPath = null;
    return;
  }
  verifiedTokenPath = path;
};

const readByConfiguredPath = (data, path) => {
  if (path == null || path === '') return undefined;
  const keys = Array.isArray(path)
    ? path
    : String(path)
        .split('.')
        .map((key) => key.trim())
        .filter(Boolean);
  let current = data;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
};

/**
 * @param {unknown} data - Raw MSG91 verifyOtp success callback argument
 * @returns {string} Verified token string (in-memory only)
 */
export const extractMsg91VerifiedToken = (data) => {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed) return trimmed;
  }

  const configured = readByConfiguredPath(data, verifiedTokenPath);
  if (typeof configured === 'string') {
    const trimmed = configured.trim();
    if (trimmed) return trimmed;
  }

  throw new Error(
    'MSG91 verified token is not available. The success-response property is pending confirmation.',
  );
};
