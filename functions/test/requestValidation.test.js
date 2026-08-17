'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateSessionRequest } = require('../src/requestValidation');
const { MAX_TOKEN_LENGTH } = require('../src/config');

describe('validateSessionRequest', () => {
  it('accepts a non-empty token string', () => {
    const result = validateSessionRequest({ token: '  abc.def  ' });
    assert.deepEqual(result, { ok: true, token: 'abc.def' });
  });

  it('rejects missing body', () => {
    assert.equal(validateSessionRequest(null).ok, false);
    assert.equal(validateSessionRequest(undefined).ok, false);
  });

  it('rejects non-object bodies', () => {
    assert.equal(validateSessionRequest('token').ok, false);
    assert.equal(validateSessionRequest(['token']).ok, false);
  });

  it('rejects empty or non-string token', () => {
    assert.equal(validateSessionRequest({ token: '' }).ok, false);
    assert.equal(validateSessionRequest({ token: '   ' }).ok, false);
    assert.equal(validateSessionRequest({ token: 123 }).ok, false);
    assert.equal(validateSessionRequest({}).ok, false);
  });

  it('rejects oversized token', () => {
    const token = 'a'.repeat(MAX_TOKEN_LENGTH + 1);
    assert.equal(validateSessionRequest({ token }).ok, false);
  });

  it('does not accept mobile fields as proof', () => {
    assert.equal(validateSessionRequest({ mobile: '9876543210' }).ok, false);
    assert.equal(
      validateSessionRequest({ mobileVerified: true, verifiedMobile: '9876543210' }).ok,
      false,
    );
  });

  it('ignores mobile fields when a valid token is present', () => {
    const result = validateSessionRequest({
      token: 'verified-token',
      mobile: '9876543210',
      mobileVerified: true,
    });
    assert.deepEqual(result, { ok: true, token: 'verified-token' });
  });
});
