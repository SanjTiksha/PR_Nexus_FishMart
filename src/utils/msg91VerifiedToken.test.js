import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMsg91VerifiedToken } from './msg91VerifiedToken.js';

// Must be at least 20 characters to pass the minimum-length check.
const FAKE_CLIENT_TOKEN = 'fake-msg91-client-token-jwt';

const assertFailsClosed = (value) => {
  assert.throws(() => extractMsg91VerifiedToken(value), (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(FAKE_CLIENT_TOKEN), false);
    return true;
  });
};

describe('extractMsg91VerifiedToken', () => {
  // --- Primary field: access-token (current MSG91 widget) ---

  it('returns access-token from a current MSG91 success object', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      message: 'success',
      'access-token': FAKE_CLIENT_TOKEN,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('prefers access-token over message when both are present', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      'access-token': FAKE_CLIENT_TOKEN,
      message: 'some-other-long-string-that-looks-like-a-token',
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('returns accessToken when access-token is absent', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      accessToken: FAKE_CLIENT_TOKEN,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('returns token field when access-token and accessToken are absent', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      token: FAKE_CLIENT_TOKEN,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  // --- Legacy fallback: message field ---

  it('returns message as legacy fallback when it looks like a real token', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      message: FAKE_CLIENT_TOKEN,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('returns the trimmed token when surrounding whitespace is present', () => {
    const result = extractMsg91VerifiedToken({
      type: 'success',
      'access-token': `  ${FAKE_CLIENT_TOKEN}  `,
    });
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  // --- Status string rejection ---

  it('rejects "success" in message as a status string, not a token', () => {
    assertFailsClosed({ type: 'success', message: 'success' });
  });

  it('rejects "verified" in message as a status string', () => {
    assertFailsClosed({ type: 'success', message: 'verified' });
  });

  it('rejects "ok" in message as a status string', () => {
    assertFailsClosed({ type: 'success', message: 'ok' });
  });

  it('rejects "true" in message as a status string', () => {
    assertFailsClosed({ type: 'success', message: 'true' });
  });

  it('rejects "done" in message as a status string', () => {
    assertFailsClosed({ type: 'success', message: 'done' });
  });

  it('rejects "sent" in message as a status string', () => {
    assertFailsClosed({ type: 'success', message: 'sent' });
  });

  it('rejects status strings case-insensitively', () => {
    assertFailsClosed({ type: 'success', message: 'SUCCESS' });
    assertFailsClosed({ type: 'success', message: 'Verified' });
    assertFailsClosed({ 'access-token': 'OK' });
  });

  it('rejects tokens shorter than 20 characters', () => {
    assertFailsClosed({ 'access-token': 'short' });
    assertFailsClosed({ message: 'tooshort' });
  });

  // --- Missing / empty / invalid ---

  it('fails closed when all token fields are missing', () => {
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
    assertFailsClosed([{ type: 'success', 'access-token': FAKE_CLIENT_TOKEN }]);
  });

  it('fails closed for a type-only object', () => {
    assertFailsClosed({ type: 'success' });
  });

  it('does not use type as the token', () => {
    assertFailsClosed({ type: FAKE_CLIENT_TOKEN });
  });

  // --- Plain string input ---

  it('returns a plain string token when it passes length and status checks', () => {
    const result = extractMsg91VerifiedToken(FAKE_CLIENT_TOKEN);
    assert.equal(result, FAKE_CLIENT_TOKEN);
  });

  it('fails closed for a plain status string', () => {
    assertFailsClosed('success');
    assertFailsClosed('verified');
    assertFailsClosed('short');
  });

  // --- No logging ---

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
        'access-token': FAKE_CLIENT_TOKEN,
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
