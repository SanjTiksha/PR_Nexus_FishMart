'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseVerifiedIndianMobile,
  toFirebaseUid,
} = require('../src/customerIdentifier');

describe('parseVerifiedIndianMobile', () => {
  it('accepts documented 91-prefixed MSG91 message', () => {
    const result = parseVerifiedIndianMobile('919999999999');
    assert.equal(result.ok, true);
    assert.equal(result.mobile10, '9999999999');
    assert.equal(result.e16491, '919999999999');
    assert.equal(result.uid, 'phone_919999999999');
  });

  it('accepts application 10-digit mobile', () => {
    const result = parseVerifiedIndianMobile('9999999999');
    assert.equal(result.ok, true);
    assert.equal(result.mobile10, '9999999999');
    assert.equal(result.uid, 'phone_919999999999');
  });

  it('trims whitespace', () => {
    const result = parseVerifiedIndianMobile('  919999999999  ');
    assert.equal(result.ok, true);
    assert.equal(result.uid, 'phone_919999999999');
  });

  it('rejects missing, empty, and non-string values', () => {
    assert.equal(parseVerifiedIndianMobile(undefined).ok, false);
    assert.equal(parseVerifiedIndianMobile('').ok, false);
    assert.equal(parseVerifiedIndianMobile('   ').ok, false);
    assert.equal(parseVerifiedIndianMobile(919999999999).ok, false);
  });

  it('rejects email and invalid mobiles', () => {
    assert.equal(parseVerifiedIndianMobile('user@example.com').ok, false);
    assert.equal(parseVerifiedIndianMobile('5123456789').ok, false);
    assert.equal(parseVerifiedIndianMobile('91').ok, false);
    assert.equal(parseVerifiedIndianMobile('abcdefghij').ok, false);
  });
});

describe('toFirebaseUid', () => {
  it('is deterministic for the same 10-digit mobile', () => {
    assert.equal(toFirebaseUid('9999999999'), 'phone_919999999999');
    assert.equal(toFirebaseUid('9999999999'), toFirebaseUid('9999999999'));
  });
});
