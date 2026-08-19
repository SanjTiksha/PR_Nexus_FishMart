import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const CAPTCHA_MOUNT_ID = 'msg91-captcha-checkout';
const VALID_TOKEN = 'hcaptcha-token-value-long-enough';

const checkoutSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/CheckoutConfirmation.jsx'),
  'utf8',
);

const mountState = {
  mount: null,
  textarea: null,
  provider: null,
  verified: false,
  listeners: new Map(),
};

const createMount = (token = '') => {
  const textarea = {
    name: 'h-captcha-response',
    value: token,
  };
  const mount = {
    id: CAPTCHA_MOUNT_ID,
    dataset: {},
    childElementCount: 1,
    querySelector(selector) {
      if (
        selector.includes('h-captcha-response') ||
        selector.includes('textarea[name="h-captcha-response"]')
      ) {
        return mountState.textarea?.value?.length > 10 ? mountState.textarea : null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'h-captcha, vanilla-hcaptcha') return [];
      if (selector.includes('msg91-otp-provider') || selector.includes('msg91-send-otp-center')) {
        return mountState.provider ? [mountState.provider] : [];
      }
      return [];
    },
    addEventListener(type, handler, capture) {
      const key = capture ? `${type}:capture` : type;
      if (!mountState.listeners.has(key)) mountState.listeners.set(key, []);
      mountState.listeners.get(key).push(handler);
    },
  };
  mountState.mount = mount;
  mountState.textarea = textarea;
  return mount;
};

const dispatchMountEvent = (type, detail = {}) => {
  const handlers = [
    ...(mountState.listeners.get(`${type}:capture`) || []),
    ...(mountState.listeners.get(type) || []),
  ];
  handlers.forEach((handler) => {
    handler({ detail, type });
  });
};

const installDomMocks = () => {
  mountState.verified = false;
  mountState.provider = {
    _ngElementStrategy: {
      componentRef: {
        instance: {
          onCaptchaVerified: () => {
            mountState.verified = true;
          },
        },
      },
    },
  };

  global.window = {
    isCaptchaVerified: () => mountState.verified,
  };

  createMount('');

  global.document = {
    getElementById(id) {
      return id === CAPTCHA_MOUNT_ID ? mountState.mount : null;
    },
    querySelectorAll(selector) {
      if (selector.includes('msg91-otp-provider') || selector.includes('msg91-send-otp-center')) {
        return mountState.provider ? [mountState.provider] : [];
      }
      return [];
    },
  };

  global.MutationObserver = class MutationObserver {
    observe() {}

    disconnect() {}
  };
};

const resetDomMocks = () => {
  delete global.window;
  delete global.document;
  delete global.MutationObserver;
  mountState.mount = null;
  mountState.textarea = null;
  mountState.provider = null;
  mountState.verified = false;
  mountState.listeners.clear();
};

describe('refreshMsg91CaptchaVerified', () => {
  beforeEach(() => {
    installDomMocks();
  });

  afterEach(() => {
    resetDomMocks();
  });

  it('returns false when no captcha token is present', async () => {
    const { refreshMsg91CaptchaVerified, onMsg91CaptchaChange } = await import('./msg91Otp.js');
    const states = [];
    const unsub = onMsg91CaptchaChange((ok) => states.push(ok));

    assert.equal(refreshMsg91CaptchaVerified(), false);
    assert.equal(states.at(-1), false);

    unsub();
  });

  it('returns true when DOM token sync succeeds', async () => {
    mountState.textarea.value = VALID_TOKEN;
    const { refreshMsg91CaptchaVerified, onMsg91CaptchaChange } = await import('./msg91Otp.js');
    const states = [];
    const unsub = onMsg91CaptchaChange((ok) => states.push(ok));

    assert.equal(refreshMsg91CaptchaVerified(), true);
    assert.equal(states.at(-1), true);

    unsub();
  });

  it('returns false when token injection does not verify', async () => {
    mountState.textarea.value = VALID_TOKEN;
    mountState.provider._ngElementStrategy.componentRef.instance = {};
    const { refreshMsg91CaptchaVerified } = await import('./msg91Otp.js');

    assert.equal(refreshMsg91CaptchaVerified(), false);
  });

  it('notifies listeners true on verified event after bridge install', async () => {
    mountState.textarea.value = VALID_TOKEN;
    const { installCaptchaTokenBridge, onMsg91CaptchaChange } = await import('./msg91Otp.js');
    const states = [];
    const unsub = onMsg91CaptchaChange((ok) => states.push(ok));

    installCaptchaTokenBridge();
    dispatchMountEvent('verified', { token: VALID_TOKEN });

    assert.equal(states.at(-1), true);

    unsub();
  });

  it('notifies listeners false on expired/error events after bridge install', async () => {
    mountState.textarea.value = VALID_TOKEN;
    const { installCaptchaTokenBridge, onMsg91CaptchaChange } = await import('./msg91Otp.js');
    const states = [];
    const unsub = onMsg91CaptchaChange((ok) => states.push(ok));

    installCaptchaTokenBridge();
    dispatchMountEvent('verified', { token: VALID_TOKEN });
    dispatchMountEvent('expired');
    assert.equal(states.at(-1), false);

    dispatchMountEvent('verified', { token: VALID_TOKEN });
    dispatchMountEvent('error');
    assert.equal(states.at(-1), false);

    unsub();
  });
});

describe('checkout captcha wiring', () => {
  it('polls via refreshMsg91CaptchaVerified and avoids mobile-number effect churn', () => {
    assert.match(checkoutSource, /refreshMsg91CaptchaVerified\(\)/);
    assert.match(checkoutSource, /checkoutCaptchaActive/);
    assert.equal(
      checkoutSource.includes('deliveryInfo.mobileNumber, addressesLoading]'),
      false,
    );
    assert.match(checkoutSource, /if \(!isMsg91CaptchaVerified\(\)\)/);
    assert.equal(checkoutSource.includes('deliveryInfo.mobileNumber, addressesLoading'), false);
  });
});
