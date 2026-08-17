/**
 * Isolated MSG91 OTP Widget for customer login only.
 * Captcha mount: #msg91-captcha-login
 *
 * Does not import checkout send/verify/retry/init helpers.
 * Does not read or write #msg91-captcha-checkout.
 * Client-side widget tokenAuth only — never AuthKey.
 *
 * Never assign/overwrite window.isCaptchaVerified / window.sendOtp /
 * window.verifyOtp / window.retryOtp — MSG91 defines those as read-only.
 */

import {
  getFriendlyOtpError,
  isValidIndianMobile,
  normalizeIndianMobile,
  toMsg91Identifier,
} from './msg91Otp';

const SCRIPT_URL = 'https://verify.msg91.com/otp-provider.js';
const LOGIN_CAPTCHA_RENDER_ID = 'msg91-captcha-login';

let loginInitPromise = null;
let loginCaptchaListeners = new Set();

const extractReqId = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return data.reqId || data.requestId || data.message || data?.data?.reqId || '';
};

const notifyLoginCaptchaListeners = (verified) => {
  loginCaptchaListeners.forEach((fn) => {
    try {
      fn(verified);
    } catch {
      /* ignore */
    }
  });
};

export const onCustomerLoginCaptchaChange = (listener) => {
  loginCaptchaListeners.add(listener);
  return () => loginCaptchaListeners.delete(listener);
};

const getLoginCaptchaMount = () =>
  typeof document !== 'undefined'
    ? document.getElementById(LOGIN_CAPTCHA_RENDER_ID)
    : null;

const captchaHasWidget = (el) => {
  if (!el) return false;
  return Boolean(
    el.querySelector('vanilla-hcaptcha') ||
      el.querySelector('h-captcha') ||
      el.querySelector('iframe') ||
      el.querySelector('.h-captcha') ||
      el.querySelector('[data-hcaptcha-widget-id]') ||
      el.childElementCount > 0,
  );
};

const readCaptchaTokenFromEvent = (event) => {
  if (!event) return '';
  return (
    event.detail?.token ||
    event.detail?.key ||
    event.detail?.response ||
    event.token ||
    event.key ||
    ''
  );
};

const readCaptchaTokenFromLoginDom = () => {
  const mount = getLoginCaptchaMount();
  if (!mount) return '';
  const response =
    mount.querySelector('textarea[name="h-captcha-response"]') ||
    mount.querySelector('textarea.h-captcha-response') ||
    mount.querySelector('[name="h-captcha-response"]');
  const value = String(response?.value || '').trim();
  return value.length > 10 ? value : '';
};

const injectCaptchaTokenIntoMsg91 = (token) => {
  if (!token || typeof document === 'undefined') return false;

  const tryInstance = (inst) => {
    if (!inst || typeof inst !== 'object') return false;
    if ('captchaToken' in inst || typeof inst.onCaptchaVerified === 'function') {
      try {
        if (typeof inst.onCaptchaVerified === 'function') {
          inst.onCaptchaVerified({ token });
        } else {
          inst.captchaToken = token;
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const roots = [];
  document.querySelectorAll('msg91-otp-provider, msg91-send-otp-center').forEach((el) => {
    roots.push(el);
    if (el.shadowRoot) roots.push(el.shadowRoot);
  });

  for (const root of roots) {
    const nodes = root.querySelectorAll
      ? [root, ...root.querySelectorAll('*')]
      : [root];
    for (const node of nodes) {
      const strategy = node._ngElementStrategy || node.ngElementStrategy;
      if (tryInstance(strategy?.componentRef?.instance)) return true;

      const ctx = node.__ngContext__;
      if (Array.isArray(ctx)) {
        for (const item of ctx) {
          if (tryInstance(item)) return true;
        }
      }
    }
  }

  return false;
};

const windowCaptchaVerified = () => {
  if (typeof window === 'undefined' || typeof window.isCaptchaVerified !== 'function') {
    return false;
  }
  try {
    return !!window.isCaptchaVerified();
  } catch {
    return false;
  }
};

const syncLoginCaptchaTokenFromUi = (tokenHint = '') => {
  const token = String(tokenHint || readCaptchaTokenFromLoginDom() || '').trim();
  if (!token) {
    notifyLoginCaptchaListeners(false);
    return false;
  }

  injectCaptchaTokenIntoMsg91(token);
  const verified = windowCaptchaVerified();
  notifyLoginCaptchaListeners(verified);
  return verified;
};

const installLoginCaptchaTokenBridge = () => {
  const mount = getLoginCaptchaMount();
  if (!mount) return;

  const onVerified = (event) => {
    syncLoginCaptchaTokenFromUi(readCaptchaTokenFromEvent(event));
  };

  const onExpired = () => {
    notifyLoginCaptchaListeners(false);
  };

  if (!mount.dataset.msg91LoginBridge) {
    mount.dataset.msg91LoginBridge = '1';
    mount.addEventListener('verified', onVerified, true);
    mount.addEventListener('expired', onExpired, true);
    mount.addEventListener('error', onExpired, true);
  }

  const bindCaptchaNodes = () => {
    mount.querySelectorAll('h-captcha, vanilla-hcaptcha').forEach((node) => {
      if (node.dataset.msg91LoginListen) return;
      node.dataset.msg91LoginListen = '1';
      node.addEventListener('verified', onVerified);
      node.addEventListener('expired', onExpired);
      node.addEventListener('error', onExpired);
    });
  };
  bindCaptchaNodes();

  if (!mount._msg91LoginMo) {
    const mo = new MutationObserver(() => {
      bindCaptchaNodes();
      if (readCaptchaTokenFromLoginDom()) syncLoginCaptchaTokenFromUi();
    });
    mo.observe(mount, { childList: true, subtree: true, attributes: true });
    mount._msg91LoginMo = mo;
  }

  if (readCaptchaTokenFromLoginDom()) syncLoginCaptchaTokenFromUi();
  else notifyLoginCaptchaListeners(false);
};

const waitForLoginCaptchaWidget = (timeoutMs = 20000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const el = getLoginCaptchaMount();
      if (captchaHasWidget(el)) {
        resolve(el);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error('Captcha failed to load. Please refresh the page and try again.'),
        );
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });

const buildLoginConfiguration = () => {
  const widgetId = import.meta.env.VITE_MSG91_WIDGET_ID;
  const tokenAuth = import.meta.env.VITE_MSG91_OTP_TOKEN;

  if (!widgetId || !tokenAuth) {
    throw new Error('Mobile verification is not configured. Please contact support.');
  }

  return {
    widgetId,
    tokenAuth,
    identifier: '',
    exposeMethods: true,
    captchaRenderId: LOGIN_CAPTCHA_RENDER_ID,
    captchaVerified: (ok) => notifyLoginCaptchaListeners(!!ok),
    success: () => {},
    failure: () => {},
  };
};

export const isCustomerLoginCaptchaVerified = () => {
  const loginToken = readCaptchaTokenFromLoginDom();
  if (!loginToken) return false;
  return syncLoginCaptchaTokenFromUi(loginToken);
};

export const initializeCustomerLoginOtp = () => {
  let configuration;
  try {
    configuration = buildLoginConfiguration();
  } catch (err) {
    return Promise.reject(err);
  }

  const mount = getLoginCaptchaMount();
  if (!mount) {
    return Promise.reject(
      new Error('Captcha container is not ready. Please refresh and try again.'),
    );
  }

  if (
    typeof window.sendOtp === 'function' &&
    typeof window.verifyOtp === 'function' &&
    captchaHasWidget(mount)
  ) {
    installLoginCaptchaTokenBridge();
    return Promise.resolve();
  }

  if (
    typeof window.sendOtp === 'function' &&
    typeof window.initSendOTP === 'function' &&
    !captchaHasWidget(mount)
  ) {
    loginInitPromise = null;
    try {
      mount.innerHTML = '';
      window.initSendOTP(configuration);
    } catch {
      return Promise.reject(
        new Error('OTP service failed to initialize. Please refresh and try again.'),
      );
    }
    return waitForLoginCaptchaWidget().then(() => {
      installLoginCaptchaTokenBridge();
    });
  }

  if (loginInitPromise) return loginInitPromise;

  loginInitPromise = new Promise((resolve, reject) => {
    const waitForMethods = (attempt = 0) => {
      if (typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function') {
        waitForLoginCaptchaWidget()
          .then(() => {
            installLoginCaptchaTokenBridge();
            resolve();
          })
          .catch((err) => {
            loginInitPromise = null;
            reject(err);
          });
        return;
      }
      if (attempt > 100) {
        loginInitPromise = null;
        reject(new Error('OTP service failed to initialize. Please refresh and try again.'));
        return;
      }
      setTimeout(() => waitForMethods(attempt + 1), 50);
    };

    const runInit = () => {
      try {
        if (!getLoginCaptchaMount()) {
          loginInitPromise = null;
          reject(
            new Error('Captcha container is not ready. Please refresh and try again.'),
          );
          return;
        }
        if (typeof window.initSendOTP === 'function') {
          window.initSendOTP(configuration);
        }
        waitForMethods();
      } catch {
        loginInitPromise = null;
        reject(new Error('OTP service failed to initialize. Please refresh and try again.'));
      }
    };

    const existing =
      document.querySelector('script[data-msg91-otp="1"]') ||
      document.querySelector('script[src="https://verify.msg91.com/otp-provider.js"]');
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
      loginInitPromise = null;
      reject(new Error('Unable to load OTP service. Check your internet connection.'));
    };
    document.body.appendChild(script);
  });

  return loginInitPromise;
};

export const sendCustomerLoginOtp = async (mobileInput) => {
  const mobile = normalizeIndianMobile(mobileInput);
  if (!isValidIndianMobile(mobile)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  await initializeCustomerLoginOtp();
  installLoginCaptchaTokenBridge();
  syncLoginCaptchaTokenFromUi();

  if (!isCustomerLoginCaptchaVerified()) {
    throw new Error('Please complete the captcha below, then click Send OTP.');
  }

  const identifier = toMsg91Identifier(mobile);

  return new Promise((resolve, reject) => {
    if (typeof window.sendOtp !== 'function') {
      reject(new Error('OTP service is not ready. Please try again.'));
      return;
    }
    window.sendOtp(
      identifier,
      (data) => resolve({ data, reqId: extractReqId(data), mobile }),
      (error) =>
        reject(
          new Error(
            getFriendlyOtpError(error, 'Could not send OTP. Please try again.'),
          ),
        ),
    );
  });
};

export const verifyCustomerLoginOtp = (otp, reqId) =>
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

export const retryCustomerLoginOtp = async (reqId) => {
  if (!isCustomerLoginCaptchaVerified()) {
    throw new Error('Please complete the captcha again, then resend OTP.');
  }

  return new Promise((resolve, reject) => {
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
};

export const MSG91_LOGIN_CAPTCHA_RENDER_ID = LOGIN_CAPTCHA_RENDER_ID;
