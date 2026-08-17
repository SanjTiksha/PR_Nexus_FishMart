import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMsg91VerifiedToken } from '../utils/msg91VerifiedToken.js';

const FAKE_CLIENT_TOKEN = 'fake-msg91-client-token';

describe('customer auth MSG91 token path', () => {
  it('maps the confirmed verifyOtp object to Function body { token } only', () => {
    const rawSuccess = { type: 'success', message: FAKE_CLIENT_TOKEN };
    const token = extractMsg91VerifiedToken(rawSuccess);
    const body = JSON.stringify({ token });
    const parsed = JSON.parse(body);

    assert.deepEqual(Object.keys(parsed), ['token']);
    assert.equal(parsed.token, FAKE_CLIENT_TOKEN);
    assert.equal(Object.hasOwn(parsed, 'mobile'), false);
    assert.equal(Object.hasOwn(parsed, 'mobileVerified'), false);
    assert.equal(Object.hasOwn(parsed, 'verifiedMobile'), false);
  });

  it('does not produce a Function body when message is invalid', () => {
    let called = false;
    try {
      extractMsg91VerifiedToken({ type: 'success' });
      called = true;
    } catch {
      /* fail closed before Function POST */
    }
    assert.equal(called, false);
  });
});
