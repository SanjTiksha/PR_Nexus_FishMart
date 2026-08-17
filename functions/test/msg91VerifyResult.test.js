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
  it('reads only message from a documented success body', () => {
    const result = extractVerifiedIdentifier({
      type: 'success',
      message: '919999999999',
    });
    assert.equal(result.ok, true);
    assert.equal(result.uid, 'phone_919999999999');
  });

  it('fails closed when message is missing or empty', () => {
    assert.equal(extractVerifiedIdentifier({ type: 'success' }).ok, false);
    assert.equal(extractVerifiedIdentifier({ type: 'success', message: '' }).ok, false);
    assert.equal(extractVerifiedIdentifier({ type: 'success', message: '   ' }).ok, false);
  });

  it('does not use guessed identifier fields', () => {
    const result = extractVerifiedIdentifier({
      type: 'success',
      mobile: '9876543210',
      identifier: '919876543210',
      token: 'nope',
      accessToken: 'nope',
      data: { mobile: '9876543210' },
    });
    assert.equal(result.ok, false);
  });
});
