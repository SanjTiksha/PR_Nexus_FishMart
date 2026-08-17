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

describe('verifyCustomerMsg91Token', () => {
  it('does not call MSG91 when AuthKey is missing', async () => {
    let called = false;
    const result = await verifyCustomerMsg91Token('widget-token', {
      env: {},
      verifyAccessToken: async () => {
        called = true;
        return { kind: 'http', status: 200, body: { type: 'success' } };
      },
    });
    assert.equal(called, false);
    assert.deepEqual(result, { ok: false, code: 'unavailable' });
  });

  it('returns ok when mocked MSG91 reports success', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async ({ authkey, accessToken }) => {
        assert.equal(authkey, 'test-authkey');
        assert.equal(accessToken, 'widget-token');
        return { kind: 'http', status: 200, body: { type: 'success' } };
      },
    });
    assert.deepEqual(result, { ok: true });
  });

  it('rejects mocked MSG91 non-success without exposing the body', async () => {
    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: async () => ({
        kind: 'http',
        status: 200,
        body: { type: 'error', message: 'secret-upstream' },
      }),
    });
    assert.deepEqual(result, { ok: false, code: 'rejected' });
    assert.equal(JSON.stringify(result).includes('secret-upstream'), false);
  });

  it('posts the documented MSG91 body when using the real client with a mock fetch', async () => {
    const { verifyAccessToken } = require('../src/msg91Client');
    let captured;
    const fetchImpl = async (url, options) => {
      captured = { url, options };
      return {
        status: 200,
        json: async () => ({ type: 'success' }),
      };
    };

    const result = await verifyCustomerMsg91Token('widget-token', {
      authkey: 'test-authkey',
      verifyAccessToken: (args) => verifyAccessToken({ ...args, fetchImpl }),
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(captured.url, MSG91_VERIFY_ACCESS_TOKEN_URL);
    const sent = JSON.parse(captured.options.body);
    assert.deepEqual(sent, {
      authkey: 'test-authkey',
      'access-token': 'widget-token',
    });
  });
});

describe('handleCustomerMsg91Session', () => {
  const deps = {
    env: {
      MSG91_AUTHKEY: 'test-authkey',
      ALLOWED_ORIGINS: localOrigin,
    },
    verifyAccessToken: async () => ({
      kind: 'http',
      status: 200,
      body: { type: 'success' },
    }),
  };

  it('handles CORS preflight for an allowed origin', async () => {
    const req = mockReq({
      method: 'OPTIONS',
      origin: localOrigin,
      contentType: 'application/json',
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, deps);
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
    await handleCustomerMsg91Session(req, res, deps);
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  });

  it('rejects GET', async () => {
    const req = mockReq({
      method: 'GET',
      origin: localOrigin,
      contentType: 'application/json',
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, deps);
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
    await handleCustomerMsg91Session(req, res, deps);
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
    await handleCustomerMsg91Session(req, res, deps);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: 'Invalid request' });
  });

  it('returns { ok: true } on mocked success and does not leak secrets', async () => {
    const req = mockReq({
      method: 'POST',
      origin: localOrigin,
      contentType: 'application/json',
      body: { token: 'widget-token' },
    });
    const res = mockRes();
    await handleCustomerMsg91Session(req, res, deps);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes('widget-token'), false);
    assert.equal(serialized.includes('test-authkey'), false);
    assert.equal(serialized.includes('mobile'), false);
  });
});
