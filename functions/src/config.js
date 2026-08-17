'use strict';

/** MSG91 server-side widget token verification. AuthKey must never be a VITE_* var. */
const MSG91_VERIFY_ACCESS_TOKEN_URL =
  'https://control.msg91.com/api/v5/widget/verifyAccessToken';

const MAX_TOKEN_LENGTH = 8192;
const MSG91_TIMEOUT_MS = 8000;

/** Local Vite / preview origins only. Production must set ALLOWED_ORIGINS. */
const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const getMsg91AuthKey = (env = process.env) => {
  const value = env.MSG91_AUTHKEY;
  return typeof value === 'string' ? value.trim() : '';
};

const getAllowedOrigins = (env = process.env) => {
  const raw = env.ALLOWED_ORIGINS;
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return LOCAL_DEV_ORIGINS.slice();
};

module.exports = {
  MSG91_VERIFY_ACCESS_TOKEN_URL,
  MAX_TOKEN_LENGTH,
  MSG91_TIMEOUT_MS,
  LOCAL_DEV_ORIGINS,
  getMsg91AuthKey,
  getAllowedOrigins,
};
