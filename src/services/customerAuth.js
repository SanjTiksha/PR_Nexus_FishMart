/**
 * Customer-login orchestration foundation (Phase 1A.1).
 *
 * Does not: use MSG91 AuthKey, call verifyAccessToken, mint Custom Tokens,
 * sign in with Firebase, trust mobileVerified, or persist tokens.
 * Checkout OTP / payment is unchanged — this module is for future /login only.
 */

import { extractMsg91VerifiedToken } from '../utils/msg91VerifiedToken';
import {
  ensureMsg91OtpReady,
  isMsg91CaptchaVerified,
  isValidIndianMobile,
  MSG91_LOGIN_CAPTCHA_RENDER_ID,
  normalizeIndianMobile,
  retryMsg91Otp,
  sendMsg91Otp,
  toMsg91Identifier,
  verifyMsg91Otp,
} from './msg91Otp';

export { MSG91_LOGIN_CAPTCHA_RENDER_ID };

const ensureLoginCaptchaReady = () =>
  ensureMsg91OtpReady({ captchaRenderId: MSG91_LOGIN_CAPTCHA_RENDER_ID });

/**
 * Send a customer-login OTP. Requires the login captcha mount to exist.
 * Does not treat the typed mobile as an authenticated identity.
 */
export const requestCustomerOtp = async (mobileInput) => {
  const mobile = normalizeIndianMobile(mobileInput);
  if (!isValidIndianMobile(mobile)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  await ensureLoginCaptchaReady();
  if (!isMsg91CaptchaVerified()) {
    throw new Error('Please complete the captcha below, then try again.');
  }

  const result = await sendMsg91Otp(toMsg91Identifier(mobile));
  return {
    reqId: result?.reqId ? String(result.reqId) : '',
    mobile,
  };
};

/**
 * Verify customer-login OTP and return the MSG91 verified token in memory.
 * Does not store the token, log it, or exchange it with a backend yet.
 */
export const verifyCustomerOtp = async (otp, reqId) => {
  const data = await verifyMsg91Otp(otp, reqId || undefined);
  const token = extractMsg91VerifiedToken(data);
  return { token };
};

export const resendCustomerOtp = async (reqId) => {
  await ensureLoginCaptchaReady();
  const result = await retryMsg91Otp(reqId || undefined);
  return {
    reqId: result?.reqId ? String(result.reqId) : reqId ? String(reqId) : '',
  };
};

/**
 * Placeholder for Phase 1A.2–1A.3 (server verifyAccessToken + Custom Token).
 * Must not be used as authentication in this phase.
 */
export const exchangeVerifiedTokenForSession = async () => {
  throw new Error('Customer session exchange is not implemented yet.');
};
