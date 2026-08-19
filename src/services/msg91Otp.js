/**
 * MSG91 OTP Widget (Web SDK, custom UI via exposeMethods + H-Captcha).
 * Client-side only — uses widget tokenAuth, never AuthKey / server APIs.
 *
 * IMPORTANT: Never assign/overwrite window.isCaptchaVerified / window.sendOtp /
 * window.verifyOtp / window.retryOtp — MSG91 defines those as read-only.
 */

const SCRIPT_URL = 'https://verify.msg91.com/otp-provider.js';
const CAPTCHA_RENDER_ID = 'msg91-captcha-checkout';

let initPromise = null;
let captchaListeners = new Set();

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
  const text =
    error.message ||
    error.msg ||
    error.error ||
    error.type ||
    (typeof error === 'object' ? JSON.stringify(error) : '');
  const lower = String(text || '').toLowerCase();
  if (lower.includes('captcha')) {
    return 'Please complete the captcha, then try Verify Mobile again.';
  }
  return text || fallback;
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

const notifyCaptchaListeners = (verified) => {
  captchaListeners.forEach((fn) => {
    try {
      fn(verified);
    } catch {
      /* ignore */
    }
  });
};

/** Subscribe to captcha solved / cleared (for UI state). */
export const onMsg91CaptchaChange = (listener) => {
  captchaListeners.add(listener);
  return () => captchaListeners.delete(listener);
};

const getCaptchaMount = () =>
  typeof document !== 'undefined' ? document.getElementById(CAPTCHA_RENDER_ID) : null;

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

const readCaptchaTokenFromDom = () => {
  const mount = getCaptchaMount();
  if (!mount) return '';
  const response =
    mount.querySelector('textarea[name="h-captcha-response"]') ||
    mount.querySelector('textarea.h-captcha-response') ||
    mount.querySelector('[name="h-captcha-response"]');
  const value = String(response?.value || '').trim();
  return value.length > 10 ? value : '';
};

/**
 * Call MSG91's own read-only API. Do not assign window.isCaptchaVerified.
 */
export const isMsg91CaptchaVerified = () => {
  if (typeof window === 'undefined' || typeof window.isCaptchaVerified !== 'function') {
    return false;
  }
  try {
    return !!window.isCaptchaVerified();
  } catch {
    return false;
  }
};

/**
 * MSG91 onCaptchaVerified expects `{ token }`, but H-Captcha web component dispatches
 * CustomEvent with `{ detail: { token } }`, so MSG91 often never stores the token.
 * Inject `{ token }` into the MSG91 component instance (does NOT overwrite window APIs).
 */
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

const syncCaptchaTokenFromUi = (tokenHint = '') => {
  const token = String(tokenHint || readCaptchaTokenFromDom() || '').trim();
  if (!token) {
    notifyCaptchaListeners(isMsg91CaptchaVerified());
    return isMsg91CaptchaVerified();
  }

  injectCaptchaTokenIntoMsg91(token);
  const verified = isMsg91CaptchaVerified();
  notifyCaptchaListeners(verified);
  return verified;
};

/** Sync hCaptcha DOM token into MSG91, then return MSG91 verified state. */
export const refreshMsg91CaptchaVerified = (tokenHint = '') =>
  syncCaptchaTokenFromUi(tokenHint);

/**
 * Listen for H-Captcha verified events and sync token into MSG91 component.
 * Never replaces window.isCaptchaVerified / window.sendOtp.
 */
export const installCaptchaTokenBridge = () => {
  const mount = getCaptchaMount();
  if (!mount) return;

  const onVerified = (event) => {
    syncCaptchaTokenFromUi(readCaptchaTokenFromEvent(event));
  };

  const onExpired = () => {
    notifyCaptchaListeners(false);
  };

  if (!mount.dataset.msg91Bridge) {
    mount.dataset.msg91Bridge = '1';
    mount.addEventListener('verified', onVerified, true);
    mount.addEventListener('expired', onExpired, true);
    mount.addEventListener('error', onExpired, true);
  }

  const bindCaptchaNodes = () => {
    mount.querySelectorAll('h-captcha, vanilla-hcaptcha').forEach((node) => {
      if (node.dataset.msg91Listen) return;
      node.dataset.msg91Listen = '1';
      node.addEventListener('verified', onVerified);
      node.addEventListener('expired', onExpired);
      node.addEventListener('error', onExpired);
    });
  };
  bindCaptchaNodes();

  if (!mount._msg91Mo) {
    const mo = new MutationObserver(() => {
      bindCaptchaNodes();
      if (readCaptchaTokenFromDom()) syncCaptchaTokenFromUi();
    });
    mo.observe(mount, { childList: true, subtree: true, attributes: true });
    mount._msg91Mo = mo;
  }

  if (readCaptchaTokenFromDom()) syncCaptchaTokenFromUi();
  else notifyCaptchaListeners(isMsg91CaptchaVerified());
};

/** Wait until MSG91 has injected H-Captcha into captchaRenderId. */
export const waitForCaptchaWidget = (timeoutMs = 20000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const el = getCaptchaMount();
      if (captchaHasWidget(el)) {
        resolve(el);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            'Captcha failed to load. Please refresh the page and try again.',
          ),
        );
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });

const buildConfiguration = () => {
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
    // Required for visible H-Captcha with custom UI
    captchaRenderId: CAPTCHA_RENDER_ID,
    captchaVerified: (ok) => notifyCaptchaListeners(!!ok),
    success: () => {},
    failure: () => {},
  };
};

/**
 * Load otp-provider.js once and init into an existing captcha mount node.
 * Captcha DOM (#msg91-captcha-checkout) MUST exist before calling this.
 */
export const ensureMsg91OtpReady = () => {
  let configuration;
  try {
    configuration = buildConfiguration();
  } catch (err) {
    return Promise.reject(err);
  }

  const mount = getCaptchaMount();
  if (!mount) {
    return Promise.reject(
      new Error('Captcha container is not ready. Open delivery details and try again.'),
    );
  }

  // Already initialized and captcha still present in the current mount node
  if (
    typeof window.sendOtp === 'function' &&
    typeof window.verifyOtp === 'function' &&
    captchaHasWidget(mount)
  ) {
    installCaptchaTokenBridge();
    return Promise.resolve();
  }

  // Methods exist but captcha was unmounted (React remount) — re-init into current mount
  if (
    typeof window.sendOtp === 'function' &&
    typeof window.initSendOTP === 'function' &&
    !captchaHasWidget(mount)
  ) {
    initPromise = null;
    try {
      mount.innerHTML = '';
      window.initSendOTP(configuration);
    } catch {
      return Promise.reject(
        new Error('OTP service failed to initialize. Please refresh and try again.'),
      );
    }
    return waitForCaptchaWidget().then(() => {
      installCaptchaTokenBridge();
    });
  }

  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    const waitForMethods = (attempt = 0) => {
      if (typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function') {
        waitForCaptchaWidget()
          .then(() => {
            installCaptchaTokenBridge();
            resolve();
          })
          .catch((err) => {
            initPromise = null;
            reject(err);
          });
        return;
      }
      if (attempt > 100) {
        initPromise = null;
        reject(new Error('OTP service failed to initialize. Please refresh and try again.'));
        return;
      }
      setTimeout(() => waitForMethods(attempt + 1), 50);
    };

    const runInit = () => {
      try {
        if (!getCaptchaMount()) {
          initPromise = null;
          reject(
            new Error(
              'Captcha container is not ready. Open delivery details and try again.',
            ),
          );
          return;
        }
        if (typeof window.initSendOTP === 'function') {
          window.initSendOTP(configuration);
        }
        waitForMethods();
      } catch {
        initPromise = null;
        reject(new Error('OTP service failed to initialize. Please refresh and try again.'));
      }
    };

    const existing = document.querySelector('script[data-msg91-otp="1"]');
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

export const sendMsg91Otp = async (identifier) => {
  await ensureMsg91OtpReady();
  installCaptchaTokenBridge();

  // Sync any completed H-Captcha response into MSG91, then trust MSG91's API only
  syncCaptchaTokenFromUi();

  if (!isMsg91CaptchaVerified()) {
    throw new Error(
      'Please complete the captcha below, then click Verify Mobile.',
    );
  }

  return new Promise((resolve, reject) => {
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
};

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
export const retryMsg91Otp = async (reqId) => {
  if (!isMsg91CaptchaVerified()) {
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

export const MSG91_CAPTCHA_RENDER_ID = CAPTCHA_RENDER_ID;
