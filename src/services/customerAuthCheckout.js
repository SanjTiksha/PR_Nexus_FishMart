/**
 * Logged-out checkout account detection via customerMsg91Session intent=checkout.
 * Does not sign in, persist tokens, or use browser-supplied mobile as identity.
 */

export const CHECKOUT_VERIFY_FAILED_MESSAGE = 'Unable to verify. Please try again.';
export const CHECKOUT_SESSION_UNAVAILABLE_MESSAGE =
  'Unable to verify your mobile right now. Please try again.';

export class CheckoutSessionExchangeError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'CheckoutSessionExchangeError';
    this.kind = kind;
  }
}

/**
 * POST { token, intent: "checkout" } for logged-out checkout account detection.
 * Returns { accountExists: true, customToken } or { accountExists: false }.
 */
export const exchangeVerifiedTokenForCheckoutSession = async (
  token,
  fetchImpl = fetch,
  sessionUrl,
) => {
  if (typeof token !== 'string' || !token.trim()) {
    throw new CheckoutSessionExchangeError(
      CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
      'unavailable',
    );
  }

  const url =
    typeof sessionUrl === 'string' && sessionUrl.trim()
      ? sessionUrl.trim()
      : typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_CUSTOMER_SESSION_URL
        : '';
  if (typeof url !== 'string' || !url.trim()) {
    throw new CheckoutSessionExchangeError(
      CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
      'unavailable',
    );
  }

  let response;
  try {
    response = await fetchImpl(url.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token.trim(), intent: 'checkout' }),
    });
  } catch {
    throw new CheckoutSessionExchangeError(
      CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
      'unavailable',
    );
  }

  if (response.status === 401) {
    throw new CheckoutSessionExchangeError(CHECKOUT_VERIFY_FAILED_MESSAGE, 'verification');
  }
  if (!response.ok) {
    throw new CheckoutSessionExchangeError(
      CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
      'unavailable',
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new CheckoutSessionExchangeError(
      CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
      'unavailable',
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new CheckoutSessionExchangeError(
      CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
      'unavailable',
    );
  }

  if (body.accountExists === true) {
    const customToken =
      typeof body.customToken === 'string' ? body.customToken.trim() : '';
    if (!customToken) {
      throw new CheckoutSessionExchangeError(
        CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
        'unavailable',
      );
    }
    return { accountExists: true, customToken };
  }

  if (body.accountExists === false) {
    return { accountExists: false };
  }

  throw new CheckoutSessionExchangeError(
    CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
    'unavailable',
  );
};
