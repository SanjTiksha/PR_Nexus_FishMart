import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMsg91VerifiedToken } from './msg91VerifiedToken.js';

const FAKE_CLIENT_TOKEN = 'fake-msg91-client-token';

const assertFailsClosed = (value) => {
  assert.throws(() => extractMsg91VerifiedToken(value), (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(FAKE_CLIENT_TOKEN), false);
    return true;
  });
};

describe('extractMsg91VerifiedToken', () => {
  it('returns message from a valid MSG91 success object', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      message: FAKE_CLIENT_TOKEN,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('returns the trimmed message when surrounding whitespace is present', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      message: `  ${FAKE_CLIENT_TOKEN}  `,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('fails closed when message is missing', () => {
    assertFailsClosed({ type: 'success' });
  });

  it('fails closed when message is empty', () => {
    assertFailsClosed({ type: 'success', message: '' });
  });

  it('fails closed when message is whitespace only', () => {
    assertFailsClosed({ type: 'success', message: '   ' });
  });

  it('fails closed when message is not a string', () => {
    assertFailsClosed({ type: 'success', message: 12345 });
    assertFailsClosed({ type: 'success', message: { nested: true } });
  });

  it('fails closed for null', () => {
    assertFailsClosed(null);
  });

  it('fails closed for undefined', () => {
    assertFailsClosed(undefined);
  });

  it('fails closed for arrays', () => {
    assertFailsClosed([]);
    assertFailsClosed([{ type: 'success', message: FAKE_CLIENT_TOKEN }]);
  });

  it('fails closed for a type-only object', () => {
    assertFailsClosed({ type: 'success' });
  });

  it('does not use type, access-token, accessToken, or token as the client token', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      message: FAKE_CLIENT_TOKEN,
      token: 'not-the-client-token',
      accessToken: 'not-the-client-token',
      'access-token': 'not-the-client-token',
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('never logs the token value', () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    const originals = {};
    const output = [];

    for (const name of methods) {
      originals[name] = console[name];
      console[name] = (...args) => {
        output.push(args.map(String).join(' '));
      };
    }

    try {
      extractMsg91VerifiedToken({
        type: 'success',
        message: FAKE_CLIENT_TOKEN,
      });
      assertFailsClosed({ type: 'success' });
    } finally {
      for (const name of methods) {
        console[name] = originals[name];
      }
    }

    assert.equal(
      output.some((line) => line.includes(FAKE_CLIENT_TOKEN)),
      false,
    );
  });
});
