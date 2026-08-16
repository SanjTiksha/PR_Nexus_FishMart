/**
 * Customer-login orchestration foundation (Phase 1A.1).
 *
 * Unused by the application. Does not initialize checkout OTP.
 * Does not: use MSG91 AuthKey, call verifyAccessToken, mint Custom Tokens,
 * sign in with Firebase, trust mobileVerified, or persist tokens.
 */

import { extractMsg91VerifiedToken } from '../utils/msg91VerifiedToken';
import { isValidIndianMobile, normalizeIndianMobile } from './msg91Otp';

/**
 * Send a customer-login OTP. Login captcha is not mounted yet.
 * Must not use the checkout OTP widget.
 */
export const requestCustomerOtp = async (mobileInput) => {
  const mobile = normalizeIndianMobile(mobileInput);
  if (!isValidIndianMobile(mobile)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  throw new Error('Customer login OTP is not implemented yet.');
};

/**
 * Verify customer-login OTP and return the MSG91 verified token in memory.
 * Does not store the token, log it, exchange it with a backend, or call
 * checkout verifyMsg91Otp.
 */
export const verifyCustomerOtp = async (otp, reqId) => {
  void otp;
  void reqId;
  const token = extractMsg91VerifiedToken(undefined);
  return { token };
};

export const resendCustomerOtp = async (reqId) => {
  void reqId;
  throw new Error('Customer login OTP is not implemented yet.');
};

/**
 * Placeholder for Phase 1A.2–1A.3 (server verifyAccessToken + Custom Token).
 * Must not be used as authentication in this phase.
 */
export const exchangeVerifiedTokenForSession = async () => {
  throw new Error('Customer session exchange is not implemented yet.');
};
