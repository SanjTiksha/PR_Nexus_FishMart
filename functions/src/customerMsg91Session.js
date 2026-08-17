'use strict';

const { getAuth } = require('firebase-admin/auth');
const { getMsg91AuthKey } = require('./config');
const {
  GENERIC,
  applyCors,
  isJsonContentType,
  sendJson,
} = require('./http');
const { validateSessionRequest } = require('./requestValidation');
const { verifyAccessToken } = require('./msg91Client');
const {
  extractVerifiedIdentifier,
  isMsg91VerificationSuccess,
} = require('./msg91VerifyResult');

const mintCustomToken = async (uid) => getAuth().createCustomToken(uid);

/**
 * Phase 1A.3: MSG91 verified token → verifyAccessToken → message → Custom Token.
 * Does not persist sessions, return the mobile, or change Firestore rules.
 */
const verifyCustomerMsg91Token = async (token, deps = {}) => {
  const authkey = deps.authkey ?? getMsg91AuthKey(deps.env);
  if (!authkey) {
    return { ok: false, code: 'unavailable' };
  }

  const verify = deps.verifyAccessToken ?? verifyAccessToken;
  const upstream = await verify({
    authkey,
    accessToken: token,
    fetchImpl: deps.fetchImpl,
  });

  if (upstream.kind !== 'http') {
    return { ok: false, code: 'unavailable' };
  }
  if (!isMsg91VerificationSuccess(upstream.status, upstream.body)) {
    return { ok: false, code: 'rejected' };
  }

  const identity = extractVerifiedIdentifier(upstream.body);
  if (!identity.ok) {
    return { ok: false, code: 'rejected' };
  }

  try {
    const createCustomToken = deps.createCustomToken ?? mintCustomToken;
    const customToken = await createCustomToken(identity.uid);
    if (typeof customToken !== 'string' || !customToken.trim()) {
      return { ok: false, code: 'token' };
    }
    return { ok: true, customToken: customToken.trim() };
  } catch {
    return { ok: false, code: 'token' };
  }
};

const handleCustomerMsg91Session = async (req, res, deps = {}) => {
  const env = deps.env ?? process.env;
  applyCors(req, res, env);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: GENERIC.invalidRequest });
    return;
  }

  if (!isJsonContentType(req)) {
    sendJson(res, 415, { error: GENERIC.invalidRequest });
    return;
  }

  const parsed = validateSessionRequest(req.body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: GENERIC.invalidRequest });
    return;
  }

  const result = await verifyCustomerMsg91Token(parsed.token, deps);
  if (result.ok) {
    sendJson(res, 200, { customToken: result.customToken });
    return;
  }
  if (result.code === 'rejected') {
    sendJson(res, 401, { error: GENERIC.verificationFailed });
    return;
  }
  if (result.code === 'token') {
    sendJson(res, 500, { error: GENERIC.unavailable });
    return;
  }
  sendJson(res, 502, { error: GENERIC.unavailable });
};

module.exports = {
  handleCustomerMsg91Session,
  verifyCustomerMsg91Token,
};
