'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractVerifiedIdentifier,
  isMsg91VerificationSuccess,
} = require('../src/msg91VerifyResult');

describe('isMsg91VerificationSuccess', () => {
  it('accepts HTTP 2xx with type success', () => {
    assert.equal(isMsg91VerificationSuccess(200, { type: 'success' }), true);
    assert.equal(isMsg91VerificationSuccess(201, { type: 'Success' }), true);
  });

  it('rejects non-2xx even if type is success', () => {
    assert.equal(isMsg91VerificationSuccess(400, { type: 'success' }), false);
    assert.equal(isMsg91VerificationSuccess(500, { type: 'success' }), false);
  });

  it('fails closed when type is missing or not success', () => {
    assert.equal(isMsg91VerificationSuccess(200, { type: 'error' }), false);
    assert.equal(isMsg91VerificationSuccess(200, { message: 'ok' }), false);
    assert.equal(isMsg91VerificationSuccess(200, {}), false);
    assert.equal(isMsg91VerificationSuccess(200, null), false);
    assert.equal(isMsg91VerificationSuccess(200, 'success'), false);
  });
});

describe('extractVerifiedIdentifier', () => {
  it('fails closed and does not guess identifier fields', () => {
    const result = extractVerifiedIdentifier({
      type: 'success',
      mobile: '9876543210',
      identifier: '919876543210',
      message: 'ok',
      token: 'nope',
      accessToken: 'nope',
      data: { mobile: '9876543210' },
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /pending confirmation/i);
  });
});
