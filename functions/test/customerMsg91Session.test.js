'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  handleCustomerMsg91Session,
  verifyCustomerMsg91Token,
} = require('../src/customerMsg91Session');
const { MSG91_VERIFY_ACCESS_TOKEN_URL } = require('../src/config');

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const mockReq = ({ method = 'POST', origin, contentType, body } = {}) => {
  const headers = {};
  if (origin) headers.origin = origin;
  if (contentType) headers['content-type'] = contentType;
  return {
    method,
    headers,
    body,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
};

const localOrigin = 'http://localhost:5173';
const MOCK_CUSTOM_TOKEN = 'firebase-custom-token-mock';

const successDeps = {
  env: {
    MSG91_AUTHKEY: 'test-authkey',
    ALLOWED_ORIGINS: localOrigin,
  },
  verifyAccessToken: async () => ({
    kind: 'http',
    status: 200,
    body: { type: 'success', message: '919999999999' },
  }),
  createCustomToken: async (uid) => {
    assert.equal(uid, 'phone_919999999999');
    return MOCK_CUSTOM_TOKEN;
  },
};

describe('verifyCustomerMsg91Token', () => {
  it('does not call MSG91 when AuthKey is missing', async () => {
    let called = false;
    const result = await verifyCustomerMsg91Token('widget-token', {
      env: {},
      verifyAccessToken: async () => {
        called = true;
        return {
          kind: 'http',
          status: 200,
          body: { type: 'success', message: '919999999999' },
        };
      },
      createCustomToken: async () => MOCK_CUSTOM_TOKEN,
    });
    assert.equal(called, false);
    assert.deepEqual(result, { ok: false, code: 'unavailable' });
  });

  it('returns a custom token for a documented MSG91 success body', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async ({ authkey, accessToken }) => {
        assert.equal(authkey, 'test-authkey');
        assert.equal(accessToken, 'widget-token');
        return {
          kind: 'http',
          status: 200,
          body: { type: 'success', message: '919999999999' },
        };
      },
      createCustomToken: async (uid) => {
        assert.equal(uid, 'phone_919999999999');
        return MOCK_CUSTOM_TOKEN;
      },
    });
    assert.deepEqual(result, {
      ok: true,
      customToken: MOCK_CUSTOM_TOKEN,
      uid: 'phone_919999999999',
    });
  });

  it('normalizes a 10-digit message to the same UID', async () => {
    let mintedUid;
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success', message: '9999999999' },
      }),
      createCustomToken: async (uid) => {
        mintedUid = uid;
        return MOCK_CUSTOM_TOKEN;
      },
    });
    assert.equal(result.ok, true);
    assert.equal(mintedUid, 'phone_919999999999');
  });

  it('rejects missing message', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success' },
      }),
      createCustomToken: async () => MOCK_CUSTOM_TOKEN,
    });
    assert.deepEqual(result, { ok: false, code: 'rejected' });
  });

  it('rejects empty message', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success', message: '   ' },
      }),
      createCustomToken: async () => MOCK_CUSTOM_TOKEN,
    });
    assert.deepEqual(result, { ok: false, code: 'rejected' });
  });

  it('rejects invalid mobile and email identifiers', async () => {
    const invalidMessages = ['user@example.com', '5123456789', '91'];
    for (const message of invalidMessages) {
      const result = await verifyCustomerMsg91Token('widget-token', {
        authkey: 'test-authkey',
        verifyAccessToken: async () => ({
          kind: 'http',
          status: 200,
          body: { type: 'success', message },
        }),
        createCustomToken: async () => MOCK_CUSTOM_TOKEN,
      });
      assert.deepEqual(result, { ok: false, code: 'rejected' });
    }
  });

  it('rejects mocked MSG91 non-success without exposing the body', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'error', message: 'secret-upstream' },
      }),
      createCustomToken: async () => MOCK_CUSTOM_TOKEN,
    });
    assert.deepEqual(result, { ok: false, code: 'rejected' });
    assert.equal(JSON.stringify(result).includes('secret-upstream'), false);
  });

  it('returns token failure when custom-token minting throws', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success', message: '919999999999' },
      }),
      createCustomToken: async () => {
        throw new Error('admin-failed');
      },
    });
    assert.deepEqual(result, { ok: false, code: 'token' });
    assert.equal(JSON.stringify(result).includes('admin-failed'), false);
  });

  it('posts the documented MSG91 body when using the real client with a mock fetch', async () => {
    const { verifyAccessToken } = require('../src/msg91Client');
    let captured;
    const fetchImpl = async (url, options) => {
      captured = { url, options };
      return {
        status: 200,
        json: async () => ({ type: 'success', message: '919999999999' }),
      };
    };

    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: (args) => verifyAccessToken({ ...args, fetchImpl }),
      createCustomToken: async () => MOCK_CUSTOM_TOKEN,
    });

    assert.deepEqual(result, {
      ok: true,
      customToken: MOCK_CUSTOM_TOKEN,
      uid: 'phone_919999999999',
    });
    assert.equal(captured.url, MSG91_VERIFY_ACCESS_TOKEN_URL);
    const sent = JSON.parse(captured.options.body);
    assert.deepEqual(sent, {
      authkey: 'test-authkey',
      'access-token': 'widget-token',
    });
  });
});

describe('handleCustomerMsg91Session', () => {
  it('handles CORS preflight for an allowed origin', async () => {
    const req = mockReq({
      method: 'OPTIONS',
      origin: localOrigin,
      contentType: 'application/json',
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['Access-Control-Allow-Origin'], localOrigin);
    assert.notEqual(res.headers['Access-Control-Allow-Origin'], '*');
  });

  it('does not use wildcard CORS for a disallowed origin', async () => {
    const req = mockReq({
      method: 'OPTIONS',
      origin: 'https://evil.example',
      contentType: 'application/json',
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  });

  it('rejects GET', async () => {
    const req = mockReq({
      method: 'GET',
      origin: localOrigin,
      contentType: 'application/json',
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 405);
  });

  it('rejects non-JSON content type', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'text/plain',
      body: { token: 'abc' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 415);
  });

  it('rejects mobile-only proof', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { mobile: '9876543210', mobileVerified: true },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: 'Invalid request' });
  });

  it('returns only customToken on success and does not leak secrets', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 200);
    const parsedBody = JSON.parse(res.body);
    assert.deepEqual(Object.keys(parsedBody), ['customToken']);
    assert.equal(parsedBody.customToken, MOCK_CUSTOM_TOKEN);
    assert.equal(Object.prototype.hasOwnProperty.call(parsedBody, 'ok'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(parsedBody, 'message'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(parsedBody, 'mobile'), false);
    const serialized = String(res.body);
    assert.equal(serialized.includes('widget-token'), false);
    assert.equal(serialized.includes('test-authkey'), false);
    assert.equal(serialized.includes('919999999999'), false);
    assert.equal(serialized.includes('9999999999'), false);
  });

  it('returns generic 401 when message is missing', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success' },
      }),
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(JSON.parse(res.body), { error: 'Verification failed' });
  });

  it('returns generic 500 when custom-token creation fails', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      createCustomToken: async () => {
        throw new Error('admin-failed');
      },
    });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(JSON.parse(res.body), { error: 'Verification unavailable' });
    assert.equal(String(res.body).includes('admin-failed'), false);
  });

  it('keeps login response as customToken only when conversion fields are absent', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token', mobile: '9999999999' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 200);
    const parsedBody = JSON.parse(res.body);
    assert.deepEqual(Object.keys(parsedBody), ['customToken']);
  });

  it('creates a session and reports orderLinked without failing Auth when claim fails', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: {
        token: 'widget-token',
        orderId: 'ORDER_1770000000000',
        conversionNonce: 'a'.repeat(64),
      },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      claimGuestCheckoutOrder: async () => ({ ok: false, reason: 'nonce' }),
    });
    assert.equal(res.statusCode, 200);
    const parsedBody = JSON.parse(res.body);
    assert.equal(parsedBody.customToken, MOCK_CUSTOM_TOKEN);
    assert.equal(parsedBody.orderLinked, false);
    assert.equal(Object.prototype.hasOwnProperty.call(parsedBody, 'uid'), false);
    assert.equal(String(res.body).includes('a'.repeat(64)), false);
  });

  it('reports orderLinked true after a successful claim and does not leak uid', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: {
        token: 'widget-token',
        orderId: 'ORDER_1770000000000',
        conversionNonce: 'b'.repeat(64),
      },
    });
    const res = mockRes();
    let claimedUid = '';
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      claimGuestCheckoutOrder: async ({ uid }) => {
        claimedUid = uid;
        return { ok: true, reason: 'linked' };
      },
    });
    assert.equal(res.statusCode, 200);
    const parsedBody = JSON.parse(res.body);
    assert.equal(parsedBody.customToken, MOCK_CUSTOM_TOKEN);
    assert.equal(parsedBody.orderLinked, true);
    assert.equal(claimedUid, 'phone_919999999999');
    assert.equal(Object.prototype.hasOwnProperty.call(parsedBody, 'uid'), false);
    assert.equal(String(res.body).includes('phone_919999999999'), false);
  });

  it('returns accountExists true with customToken for existing customer checkout intent', async () => {
    let getUserCalls = 0;
    let createTokenCalls = 0;
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token', intent: 'checkout' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      getUser: async (uid) => {
        getUserCalls += 1;
        assert.equal(uid, 'phone_919999999999');
        return { uid };
      },
      createCustomToken: async (uid) => {
        createTokenCalls += 1;
        assert.equal(uid, 'phone_919999999999');
        return MOCK_CUSTOM_TOKEN;
      },
    });
    assert.equal(res.statusCode, 200);
    const parsedBody = JSON.parse(res.body);
    assert.equal(parsedBody.accountExists, true);
    assert.equal(parsedBody.customToken, MOCK_CUSTOM_TOKEN);
    assert.equal(Object.prototype.hasOwnProperty.call(parsedBody, 'orderLinked'), false);
    assert.equal(getUserCalls, 1);
    assert.equal(createTokenCalls, 1);
  });

  it('returns accountExists false without customToken for new customer checkout intent', async () => {
    let getUserCalls = 0;
    let createTokenCalls = 0;
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token', intent: 'checkout' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      getUser: async (uid) => {
        getUserCalls += 1;
        assert.equal(uid, 'phone_919999999999');
        const error = new Error('user not found');
        error.code = 'auth/user-not-found';
        throw error;
      },
      createCustomToken: async () => {
        createTokenCalls += 1;
        return MOCK_CUSTOM_TOKEN;
      },
    });
    assert.equal(res.statusCode, 200);
    const parsedBody = JSON.parse(res.body);
    assert.deepEqual(parsedBody, { accountExists: false });
    assert.equal(getUserCalls, 1);
    assert.equal(createTokenCalls, 0);
  });

  it('returns server error for unexpected getUser failure on checkout intent', async () => {
    let createTokenCalls = 0;
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token', intent: 'checkout' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      getUser: async () => {
        const error = new Error('admin-unavailable');
        error.code = 'auth/internal-error';
        throw error;
      },
      createCustomToken: async () => {
        createTokenCalls += 1;
        return MOCK_CUSTOM_TOKEN;
      },
      logError: () => {},
    });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(JSON.parse(res.body), { error: 'Verification unavailable' });
    assert.equal(createTokenCalls, 0);
    assert.equal(String(res.body).includes('admin-unavailable'), false);
  });

  it('rejects invalid intent with 400', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token', intent: 'something-else' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, successDeps);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: 'Invalid request' });
  });

  it('returns 401 for checkout intent when MSG91 verification fails', async () => {
    let getUserCalls = 0;
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token', intent: 'checkout' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, {
      ...successDeps,
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success' },
      }),
      getUser: async () => {
        getUserCalls += 1;
        return { uid: 'phone_919999999999' };
      },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(JSON.parse(res.body), { error: 'Verification failed' });
    assert.equal(getUserCalls, 0);
  });
});

describe('verifyCustomerMsg91Token checkout intent', () => {
  it('returns accountExists true and mints token when Auth user exists', async () => {
    let createTokenCalls = 0;
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      intent: 'checkout',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success', message: '919999999999' },
      }),
      getUser: async (uid) => {
        assert.equal(uid, 'phone_919999999999');
        return { uid };
      },
      createCustomToken: async (uid) => {
        createTokenCalls += 1;
        assert.equal(uid, 'phone_919999999999');
        return MOCK_CUSTOM_TOKEN;
      },
    });
    assert.deepEqual(result, {
      ok: true,
      accountExists: true,
      customToken: MOCK_CUSTOM_TOKEN,
      uid: 'phone_919999999999',
    });
    assert.equal(createTokenCalls, 1);
  });

  it('returns accountExists false without minting when Auth user is missing', async () => {
    let createTokenCalls = 0;
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      intent: 'checkout',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'success', message: '919999999999' },
      }),
      getUser: async () => {
        const error = new Error('user not found');
        error.code = 'auth/user-not-found';
        throw error;
      },
      createCustomToken: async () => {
        createTokenCalls += 1;
        return MOCK_CUSTOM_TOKEN;
      },
    });
    assert.deepEqual(result, {
      ok: true,
      accountExists: false,
      uid: 'phone_919999999999',
    });
    assert.equal(createTokenCalls, 0);
  });
});
