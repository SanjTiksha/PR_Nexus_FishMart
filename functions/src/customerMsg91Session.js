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
const {
  claimGuestCheckoutOrder,
  parseConversionRequest,
} = require('./claimGuestCheckoutOrder');

const mintCustomToken = async (uid) => getAuth().createCustomToken(uid);
const defaultGetUser = (uid) => getAuth().getUser(uid);

const isAuthUserNotFound = (error) => {
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === 'auth/user-not-found';
};

const mintVerifiedCustomToken = async (uid, deps) => {
  const createCustomToken = deps.createCustomToken ?? mintCustomToken;
  const customToken = await createCustomToken(uid);
  if (typeof customToken !== 'string' || !customToken.trim()) {
    return { ok: false, code: 'token' };
  }
  return {
    ok: true,
    customToken: customToken.trim(),
    uid,
  };
};

/**
 * Phase 1A.3: MSG91 verified token → verifyAccessToken → message → Custom Token.
 * Does not persist sessions, return the mobile, or change Firestore rules.
 */
const verifyCustomerMsg91Token = async (token, deps = {}) => {
  const intent = deps.intent === 'checkout' ? 'checkout' : 'session';
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

  if (intent === 'checkout') {
    const getUser = deps.getUser ?? defaultGetUser;
    try {
      await getUser(identity.uid);
    } catch (error) {
      if (isAuthUserNotFound(error)) {
        return {
          ok: true,
          accountExists: false,
          uid: identity.uid,
        };
      }
      const logError = deps.logError ?? console.error;
      logError('customerMsg91Session getUser failed');
      return { ok: false, code: 'token' };
    }

    try {
      const minted = await mintVerifiedCustomToken(identity.uid, deps);
      if (!minted.ok) {
        return minted;
      }
      return {
        ok: true,
        accountExists: true,
        customToken: minted.customToken,
        uid: identity.uid,
      };
    } catch {
      return { ok: false, code: 'token' };
    }
  }

  try {
    return await mintVerifiedCustomToken(identity.uid, deps);
  } catch {
    return { ok: false, code: 'token' };
  }
};

const defaultGetOrder = async (collectionName, orderId) => {
  const { getFirestore } = require('firebase-admin/firestore');
  const snap = await getFirestore().collection(collectionName).doc(orderId).get();
  if (!snap || typeof snap.exists !== 'boolean') {
    return { exists: false, data: null };
  }
  return {
    exists: snap.exists === true,
    data: snap.exists === true ? snap.data() : null,
  };
};

const defaultUpdateOrder = async (collectionName, orderId, patch) => {
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  const payload = { customerUid: patch.customerUid };
  if (patch.conversionNonce === null) {
    payload.conversionNonce = FieldValue.delete();
  }
  await getFirestore().collection(collectionName).doc(orderId).update(payload);
};

const linkGuestOrderIfRequested = async (reqBody, uid, deps = {}) => {
  const conversion = parseConversionRequest(reqBody);
  if (!conversion.requested) {
    return { include: false };
  }
  if (!conversion.ok) {
    return { include: true, orderLinked: false };
  }

  const claim = deps.claimGuestCheckoutOrder ?? claimGuestCheckoutOrder;
  try {
    const result = await claim({
      uid,
      orderId: conversion.orderId,
      conversionNonce: conversion.conversionNonce,
      getOrder: deps.getOrder ?? defaultGetOrder,
      updateOrder: deps.updateOrder ?? defaultUpdateOrder,
    });
    return { include: true, orderLinked: result.ok === true };
  } catch {
    return { include: true, orderLinked: false };
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

  const result = await verifyCustomerMsg91Token(parsed.token, {
    ...deps,
    intent: parsed.intent,
  });
  if (result.ok) {
    if (parsed.intent === 'checkout') {
      if (result.accountExists === true) {
        sendJson(res, 200, {
          accountExists: true,
          customToken: result.customToken,
        });
        return;
      }
      sendJson(res, 200, { accountExists: false });
      return;
    }

    const linked = await linkGuestOrderIfRequested(req.body, result.uid, deps);
    const body = { customToken: result.customToken };
    if (linked.include) {
      body.orderLinked = linked.orderLinked === true;
    }
    sendJson(res, 200, body);
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
