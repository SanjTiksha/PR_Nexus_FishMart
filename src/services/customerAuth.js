/**
 * Customer-login orchestration.
 *
 * Uses the isolated login OTP widget only (msg91LoginOtp.js).
 * Does not use checkout OTP helpers, MSG91 AuthKey, or mobileVerified.
 * Does not persist tokens or log them.
 */

import { extractMsg91VerifiedToken } from '../utils/msg91VerifiedToken';
import { isValidIndianMobile, normalizeIndianMobile } from './msg91Otp';
import {
  retryCustomerLoginOtp,
  sendCustomerLoginOtp,
  verifyCustomerLoginOtp,
} from './msg91LoginOtp';

const GENERIC_VERIFY_ERROR = 'Unable to verify. Please try again.';
const GENERIC_SESSION_ERROR = 'Unable to complete login. Please try again.';

export const requestCustomerOtp = async (mobileInput) => {
  const mobile = normalizeIndianMobile(mobileInput);
  if (!isValidIndianMobile(mobile)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }
  return sendCustomerLoginOtp(mobile);
};

export const verifyCustomerOtp = async (otp, reqId) => {
  const rawSuccess = await verifyCustomerLoginOtp(otp, reqId);
  try {
    const token = extractMsg91VerifiedToken(rawSuccess);
    return { token };
  } catch {
    throw new Error(GENERIC_VERIFY_ERROR);
  }
};

export const resendCustomerOtp = async (reqId) => {
  return retryCustomerLoginOtp(reqId);
};

/**
 * POST { token } to the public customer session Function.
 * Returns { customToken } in memory only.
 */
export const exchangeVerifiedTokenForSession = async (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  const url = import.meta.env.VITE_CUSTOMER_SESSION_URL;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  let response;
  try {
    response = await fetch(url.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token.trim() }),
    });
  } catch {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  if (!response.ok) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  const customToken =
    body && typeof body === 'object' && !Array.isArray(body) ? body.customToken : '';
  if (typeof customToken !== 'string' || !customToken.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  return { customToken: customToken.trim() };
};

export {
  CHECKOUT_VERIFY_FAILED_MESSAGE,
  CHECKOUT_SESSION_UNAVAILABLE_MESSAGE,
  CheckoutSessionExchangeError,
  exchangeVerifiedTokenForCheckoutSession,
} from './customerAuthCheckout.js';
