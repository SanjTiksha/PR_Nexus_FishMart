import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CONVERSION_ACCOUNT_FAILED_MESSAGE,
  CONVERSION_ADDRESS_FAILED_MESSAGE,
  captureCheckoutVerifiedToken,
  createSaveAddressInFlightGuard,
  exchangeVerifiedTokenForGuestConversion,
  generateConversionNonce,
  isValidConversionNonce,
  runSaveConvertedAddressOnce,
  shouldOfferGuestConversion,
  stripConversionSecrets,
  toSavedAddressInputFromDelivery,
} from './guestCheckoutConversion.js';
import { applyOrderCustomerOwnership } from './orderCustomerOwnership.js';
import { buildCustomerAddressPayload } from './customerAddresses.js';

const VALID_MOBILE10 = '9999999999';
const VALID_UID = `phone_91${VALID_MOBILE10}`;
const ORDER_ID = 'ORDER_1770000000000';

const guestOrder = {
  orderId: ORDER_ID,
  items: [{ name: 'Pomfret', qty: 1, rate: 500 }],
  totalPrice: 250,
  amountPaise: 25000,
  paymentStatus: 'PENDING_CONFIRMATION',
  paidVerified: false,
  conversionNonce: 'ab'.repeat(32),
  deliveryInfo: {
    customerName: 'Guest Name',
    mobileNumber: VALID_MOBILE10,
    address: '12 Harbour Road',
    location: { lat: 19.07, lng: 72.87, confirmed: true },
  },
};

describe('guest checkout conversion helpers', () => {
  it('lets a verified checkout token be captured without treating typed mobile as proof', () => {
    const token = captureCheckoutVerifiedToken({
      type: 'success',
      message: 'checkout-widget-jwt',
      mobile: '9999999999',
    });
    assert.equal(token, 'checkout-widget-jwt');
    assert.equal(captureCheckoutVerifiedToken({ mobileVerified: true }), '');
  });

  it('rejects conversion helpers for unverified/empty capture', () => {
    assert.equal(captureCheckoutVerifiedToken({ type: 'success' }), '');
  });

  it('does not offer conversion for an already-owned customer order', () => {
    assert.equal(
      shouldOfferGuestConversion({ ...guestOrder, customerUid: VALID_UID }, null),
      false,
    );
    assert.equal(
      shouldOfferGuestConversion(guestOrder, { uid: VALID_UID }),
      false,
    );
    assert.equal(shouldOfferGuestConversion(guestOrder, null), true);
  });

  it('strips conversion secrets before browser storage or UI', () => {
    const publicOrder = stripConversionSecrets({
      ...guestOrder,
      verifiedToken: 'secret-jwt',
      customToken: 'secret-custom',
    });
    assert.equal(Object.hasOwn(publicOrder, 'conversionNonce'), false);
    assert.equal(Object.hasOwn(publicOrder, 'verifiedToken'), false);
    assert.equal(Object.hasOwn(publicOrder, 'customToken'), false);
    assert.equal(publicOrder.orderId, ORDER_ID);
    assert.equal(publicOrder.totalPrice, 250);
  });

  it('keeps guest order financial fields unchanged when ownership is applied later', () => {
    const before = applyOrderCustomerOwnership(guestOrder, null);
    const after = applyOrderCustomerOwnership(guestOrder, { uid: VALID_UID });
    assert.equal(Object.hasOwn(before, 'customerUid'), false);
    assert.equal(after.customerUid, VALID_UID);
    assert.equal(after.totalPrice, before.totalPrice);
    assert.equal(after.paymentStatus, before.paymentStatus);
    assert.deepEqual(after.items, before.items);
    assert.equal(after.deliveryInfo.address, before.deliveryInfo.address);
  });

  it('maps delivery snapshot to one saved-address payload without isDefault', () => {
    const input = toSavedAddressInputFromDelivery(guestOrder.deliveryInfo);
    const payload = buildCustomerAddressPayload(input, 'addr1', {
      createdAt: 'ts',
      updatedAt: 'ts',
    });
    assert.equal(payload.label, 'Home');
    assert.equal(payload.fullName, 'Guest Name');
    assert.equal(payload.mobile10, VALID_MOBILE10);
    assert.equal(Object.hasOwn(payload, 'isDefault'), false);
    assert.equal(Object.hasOwn(payload, 'customerUid'), false);
    assert.equal(Object.hasOwn(payload, 'paymentStatus'), false);
  });

  it('does not build an address when the customer chooses Not Now', () => {
    assert.equal(toSavedAddressInputFromDelivery(null), null);
  });

  it('posts token, orderId, and nonce only and still requires customToken', async () => {
    let captured;
    const result = await exchangeVerifiedTokenForGuestConversion(
      {
        token: 'checkout-widget-jwt',
        orderId: ORDER_ID,
        conversionNonce: 'ab'.repeat(32),
        sessionUrl: 'http://127.0.0.1:5001/session',
      },
      async (url, options) => {
        captured = { url, options };
        return {
          ok: true,
          json: async () => ({ customToken: 'firebase-custom', orderLinked: true }),
        };
      },
    );
    const sent = JSON.parse(captured.options.body);
    assert.deepEqual(Object.keys(sent).sort(), ['conversionNonce', 'orderId', 'token']);
    assert.equal(result.customToken, 'firebase-custom');
    assert.equal(result.orderLinked, true);
  });

  it('treats a successful Auth with failed order link as account-ok and order-unlinked', async () => {
    const result = await exchangeVerifiedTokenForGuestConversion(
      {
        token: 'checkout-widget-jwt',
        orderId: ORDER_ID,
        conversionNonce: 'ab'.repeat(32),
        sessionUrl: 'http://127.0.0.1:5001/session',
      },
      async () => ({
        ok: true,
        json: async () => ({ customToken: 'firebase-custom', orderLinked: false }),
      }),
    );
    assert.equal(result.customToken, 'firebase-custom');
    assert.equal(result.orderLinked, false);
    assert.match(CONVERSION_ACCOUNT_FAILED_MESSAGE, /order is confirmed/i);
    assert.match(CONVERSION_ADDRESS_FAILED_MESSAGE, /Account created/i);
  });

  it('generates a 64-character nonce', () => {
    const nonce = generateConversionNonce({
      getRandomValues: (bytes) => {
        bytes.fill(7);
        return bytes;
      },
    });
    assert.equal(isValidConversionNonce(nonce), true);
    assert.equal(nonce.length, 64);
  });

  it('does not invoke createCustomerAddress more than once while Save Address is pending', async () => {
    const guard = createSaveAddressInFlightGuard();
    let started = 0;
    let finished = 0;
    let release;
    const pendingCreate = () => {
      started += 1;
      return new Promise((resolve) => {
        release = () => {
          finished += 1;
          resolve({ status: 'ok' });
        };
      });
    };

    const first = runSaveConvertedAddressOnce(guard, pendingCreate);
    const second = runSaveConvertedAddressOnce(guard, pendingCreate);
    const third = runSaveConvertedAddressOnce(guard, pendingCreate);

    await Promise.resolve();
    assert.equal(started, 1);
    assert.equal(finished, 0);

    const secondResult = await second;
    const thirdResult = await third;
    assert.equal(secondResult.status, 'busy');
    assert.equal(thirdResult.status, 'busy');
    assert.equal(started, 1);

    release();
    const firstResult = await first;
    assert.equal(firstResult.status, 'ok');
    assert.equal(started, 1);
    assert.equal(finished, 1);
  });

  it('allows Save Address retry after a failed create', async () => {
    const guard = createSaveAddressInFlightGuard();
    const calls = [];
    const failed = await runSaveConvertedAddressOnce(guard, async () => {
      calls.push('fail');
      return { status: 'failed' };
    });
    const retried = await runSaveConvertedAddressOnce(guard, async () => {
      calls.push('ok');
      return { status: 'ok' };
    });
    assert.equal(failed.status, 'failed');
    assert.equal(retried.status, 'ok');
    assert.deepEqual(calls, ['fail', 'ok']);
  });
});

describe('guest conversion source safety', () => {
  it('does not change the login-only customerAuth session body', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'customerAuth.js'), 'utf8');
    assert.match(source, /JSON\.stringify\(\{ token: token\.trim\(\) \}\)/);
    assert.equal(source.includes('conversionNonce'), false);
    assert.equal(source.includes('orderId'), false);
  });

  it('does not weaken admin-only order updates in Firestore rules', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const rules = readFileSync(join(here, '../../firestore.rules'), 'utf8');
    assert.match(rules, /allow update, delete: if isAdmin\(\);/);
  });

  it('wires Save Address through the in-flight guard before createCustomerAddress', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const ui = readFileSync(join(here, '../components/TransactionSuccess.jsx'), 'utf8');
    const app = readFileSync(join(here, '../App.jsx'), 'utf8');
    assert.match(ui, /createSaveAddressInFlightGuard/);
    assert.match(ui, /runSaveConvertedAddressOnce/);
    assert.match(ui, /disabled=\{conversionBusy\}/);
    assert.match(app, /createCustomerAddress\(auth\.currentUser, input\)/);
    assert.equal(app.includes('isDefault'), false);
  });
});
