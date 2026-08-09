/**
 * MSG91 OTP Widget (Web SDK, custom UI via exposeMethods).
 * Client-side only — uses widget tokenAuth, never AuthKey / server APIs.
 */

const SCRIPT_URL = 'https://verify.msg91.com/otp-provider.js';
const CAPTCHA_RENDER_ID = 'msg91-captcha-checkout';

let initPromise = null;

/** Digits-only 10-digit Indian mobile from user input */
export const normalizeIndianMobile = (input) => {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits;
};

export const isValidIndianMobile = (mobile10) => /^[6-9]\d{9}$/.test(String(mobile10 || ''));

/** MSG91 identifier: 91 + 10 digits (no +) */
export const toMsg91Identifier = (mobile10) => `91${normalizeIndianMobile(mobile10)}`;

export const maskMobile = (mobile10) => {
  const m = normalizeIndianMobile(mobile10);
  if (m.length !== 10) return '**********';
  return `${m.slice(0, 2)}******${m.slice(-2)}`;
};

export const getFriendlyOtpError = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return (
    error.message ||
    error.msg ||
    error.error ||
    error.type ||
    fallback
  );
};

const extractReqId = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return (
    data.reqId ||
    data.requestId ||
    data.message ||
    data?.data?.reqId ||
    ''
  );
};

/**
 * Load otp-provider.js once and init with exposeMethods (no default MSG91 popup).
 */
export const ensureMsg91OtpReady = () => {
  const widgetId = import.meta.env.VITE_MSG91_WIDGET_ID;
  const tokenAuth = import.meta.env.VITE_MSG91_OTP_TOKEN;

  if (!widgetId || !tokenAuth) {
    return Promise.reject(
      new Error('Mobile verification is not configured. Please contact support.'),
    );
  }

  if (typeof window !== 'undefined' && typeof window.sendOtp === 'function') {
    return Promise.resolve();
  }

  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    const configuration = {
      widgetId,
      tokenAuth,
      identifier: '',
      exposeMethods: true,
      captchaRenderId: CAPTCHA_RENDER_ID,
      success: () => {},
      failure: () => {},
    };

    const waitForMethods = (attempt = 0) => {
      if (typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function') {
        resolve();
        return;
      }
      if (attempt > 80) {
        initPromise = null;
        reject(new Error('OTP service failed to initialize. Please refresh and try again.'));
        return;
      }
      setTimeout(() => waitForMethods(attempt + 1), 50);
    };

    const runInit = () => {
      try {
        if (typeof window.initSendOTP === 'function') {
          window.initSendOTP(configuration);
        }
        waitForMethods();
      } catch {
        initPromise = null;
        reject(new Error('OTP service failed to initialize. Please refresh and try again.'));
      }
    };

    const existing = document.querySelector(`script[data-msg91-otp="1"]`);
    if (existing) {
      runInit();
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.dataset.msg91Otp = '1';
    script.onload = runInit;
    script.onerror = () => {
      initPromise = null;
      reject(new Error('Unable to load OTP service. Check your internet connection.'));
    };
    document.body.appendChild(script);
  });

  return initPromise;
};

export const sendMsg91Otp = (identifier) =>
  new Promise((resolve, reject) => {
    if (typeof window.sendOtp !== 'function') {
      reject(new Error('OTP service is not ready. Please try again.'));
      return;
    }
    window.sendOtp(
      identifier,
      (data) => resolve({ data, reqId: extractReqId(data) }),
      (error) =>
        reject(
          new Error(
            getFriendlyOtpError(error, 'Could not send OTP. Please try again.'),
          ),
        ),
    );
  });

export const verifyMsg91Otp = (otp, reqId) =>
  new Promise((resolve, reject) => {
    if (typeof window.verifyOtp !== 'function') {
      reject(new Error('OTP service is not ready. Please try again.'));
      return;
    }
    const args = [
      otp,
      (data) => resolve(data),
      (error) =>
        reject(
          new Error(
            getFriendlyOtpError(error, 'Invalid or expired OTP. Please try again.'),
          ),
        ),
    ];
    if (reqId) args.push(reqId);
    window.verifyOtp(...args);
  });

/** Default channel (null) per MSG91 docs for default widget config */
export const retryMsg91Otp = (reqId) =>
  new Promise((resolve, reject) => {
    if (typeof window.retryOtp !== 'function') {
      reject(new Error('OTP service is not ready. Please try again.'));
      return;
    }
    const args = [
      null,
      (data) => resolve({ data, reqId: extractReqId(data) || reqId }),
      (error) =>
        reject(
          new Error(
            getFriendlyOtpError(error, 'Could not resend OTP. Please try again.'),
          ),
        ),
    ];
    if (reqId) args.push(reqId);
    window.retryOtp(...args);
  });

export const MSG91_CAPTCHA_RENDER_ID = CAPTCHA_RENDER_ID;
