import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
  CHECKOUT_VERIFY_FAILED_MESSAGE,
  CheckoutSessionExchangeError,
  exchangeVerifiedTokenForCheckoutSession,
} from './customerAuthCheckout.js';

const CHECKOUT_TOKEN = 'checkout-widget-access-token-jwt-value';
const MOCK_CUSTOM_TOKEN = 'firebase-custom-token-for-existing-account';
const SESSION_URL = 'https://example.test/customerMsg91Session';

const mockFetch = (responseFactory) => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    return responseFactory(url, options, calls);
  };
  return { fetchImpl, getCalls: () => calls };
};

describe('exchangeVerifiedTokenForCheckoutSession', () => {
  it('returns accountExists true with customToken for an existing account', async () => {
    const { fetchImpl, getCalls } = mockFetch(async (url, options) => {
      assert.equal(url, SESSION_URL);
      assert.deepEqual(JSON.parse(options.body), {
        token: CHECKOUT_TOKEN,
        intent: 'checkout',
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ accountExists: true, customToken: MOCK_CUSTOM_TOKEN }),
      };
    });

    const result = await exchangeVerifiedTokenForCheckoutSession(
      CHECKOUT_TOKEN,
      fetchImpl,
      SESSION_URL,
    );

    assert.deepEqual(result, {
      accountExists: true,
      customToken: MOCK_CUSTOM_TOKEN,
    });
    assert.equal(getCalls(), 1);
  });

  it('returns accountExists false without customToken for a new account', async () => {
    const { fetchImpl, getCalls } = mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ accountExists: false }),
    }));

    const result = await exchangeVerifiedTokenForCheckoutSession(
      CHECKOUT_TOKEN,
      fetchImpl,
      SESSION_URL,
    );

    assert.deepEqual(result, { accountExists: false });
    assert.equal(Object.hasOwn(result, 'customToken'), false);
    assert.equal(getCalls(), 1);
  });

  it('throws a verification error on HTTP 401', async () => {
    const { fetchImpl } = mockFetch(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Verification failed' }),
    }));

    await assert.rejects(
      () => exchangeVerifiedTokenForCheckoutSession(CHECKOUT_TOKEN, fetchImpl, SESSION_URL),
      (error) => {
        assert.ok(error instanceof CheckoutSessionExchangeError);
        assert.equal(error.kind, 'verification');
        assert.equal(error.message, CHECKOUT_VERIFY_FAILED_MESSAGE);
        return true;
      },
    );
  });

  it('throws an unavailable error on HTTP 500', async () => {
    const { fetchImpl } = mockFetch(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Verification unavailable' }),
    }));

    await assert.rejects(
      () => exchangeVerifiedTokenForCheckoutSession(CHECKOUT_TOKEN, fetchImpl, SESSION_URL),
      (error) => {
        assert.ok(error instanceof CheckoutSessionExchangeError);
        assert.equal(error.kind, 'unavailable');
        assert.equal(error.message, CHECKOUT_SESSION_UNAVAILABLE_MESSAGE);
        return true;
      },
    );
  });

  it('rejects accountExists true without a customToken', async () => {
    const { fetchImpl } = mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ accountExists: true }),
    }));

    await assert.rejects(
      () => exchangeVerifiedTokenForCheckoutSession(CHECKOUT_TOKEN, fetchImpl, SESSION_URL),
      (error) => {
        assert.ok(error instanceof CheckoutSessionExchangeError);
        assert.equal(error.kind, 'unavailable');
        return true;
      },
    );
  });

  it('rejects missing checkout token before calling the backend', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ accountExists: false }) };
    };

    await assert.rejects(() =>
      exchangeVerifiedTokenForCheckoutSession('   ', fetchImpl, SESSION_URL),
    );
    assert.equal(called, false);
  });
});
