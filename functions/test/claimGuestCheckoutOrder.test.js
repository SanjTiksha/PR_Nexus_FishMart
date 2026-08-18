'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  claimGuestCheckoutOrder,
  parseConversionRequest,
} = require('../src/claimGuestCheckoutOrder');

const UID = 'phone_919999999999';
const OTHER_UID = 'phone_918888888888';
const ORDER_ID = 'ORDER_1770000000000';
const NONCE = 'ab'.repeat(32);

const guestOrder = {
  orderId: ORDER_ID,
  paymentStatus: 'PENDING_CONFIRMATION',
  paidVerified: false,
  totalPrice: 250,
  items: [{ name: 'Pomfret', qty: 1 }],
  conversionNonce: NONCE,
  deliveryInfo: { mobileNumber: '9999999999', customerName: 'Guest', address: 'Addr' },
};

describe('parseConversionRequest', () => {
  it('is not requested for a login-only token body', () => {
    assert.deepEqual(parseConversionRequest({ token: 'widget-token' }), { requested: false });
  });

  it('rejects an arbitrary orderId without a valid nonce', () => {
    const parsed = parseConversionRequest({ token: 'widget-token', orderId: ORDER_ID });
    assert.equal(parsed.requested, true);
    assert.equal(parsed.ok, false);
  });
});

describe('claimGuestCheckoutOrder', () => {
  it('links a guest order that matches uid, nonce, and delivery mobile', async () => {
    const updates = [];
    const result = await claimGuestCheckoutOrder({
      uid: UID,
      orderId: ORDER_ID,
      conversionNonce: NONCE,
      getOrder: async () => ({ exists: true, data: { ...guestOrder } }),
      updateOrder: async (collectionName, orderId, patch) => {
        updates.push({ collectionName, orderId, patch });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'linked');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].collectionName, 'orders');
    assert.equal(updates[0].orderId, ORDER_ID);
    assert.equal(updates[0].patch.customerUid, UID);
    assert.equal(updates[0].patch.conversionNonce, null);
    assert.equal(Object.prototype.hasOwnProperty.call(updates[0].patch, 'paymentStatus'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(updates[0].patch, 'totalPrice'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(updates[0].patch, 'items'), false);
  });

  it('is idempotent when the same customer already owns the order', async () => {
    let updated = false;
    const result = await claimGuestCheckoutOrder({
      uid: UID,
      orderId: ORDER_ID,
      conversionNonce: NONCE,
      getOrder: async () => ({
        exists: true,
        data: { ...guestOrder, customerUid: UID },
      }),
      updateOrder: async () => {
        updated = true;
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'already-linked');
    assert.equal(updated, false);
  });

  it('rejects an arbitrary orderId with the wrong nonce', async () => {
    let updated = false;
    const result = await claimGuestCheckoutOrder({
      uid: UID,
      orderId: ORDER_ID,
      conversionNonce: 'cd'.repeat(32),
      getOrder: async () => ({ exists: true, data: { ...guestOrder } }),
      updateOrder: async () => {
        updated = true;
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'nonce');
    assert.equal(updated, false);
  });

  it('rejects a correct nonce used with a mismatched orderId', async () => {
    const otherOrderId = 'ORDER_1770000000999';
    const otherNonce = 'ef'.repeat(32);
    const loaded = [];
    let updated = false;
    const result = await claimGuestCheckoutOrder({
      uid: UID,
      orderId: otherOrderId,
      conversionNonce: NONCE,
      getOrder: async (collectionName, orderId) => {
        loaded.push({ collectionName, orderId });
        return {
          exists: true,
          data: {
            ...guestOrder,
            orderId: otherOrderId,
            conversionNonce: otherNonce,
          },
        };
      },
      updateOrder: async () => {
        updated = true;
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'nonce');
    assert.equal(updated, false);
    assert.deepEqual(loaded, [{ collectionName: 'orders', orderId: otherOrderId }]);
  });

  it('does not let another customer take a guest order', async () => {
    let updated = false;
    const result = await claimGuestCheckoutOrder({
      uid: OTHER_UID,
      orderId: ORDER_ID,
      conversionNonce: NONCE,
      getOrder: async () => ({ exists: true, data: { ...guestOrder } }),
      updateOrder: async () => {
        updated = true;
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'mobile-mismatch');
    assert.equal(updated, false);
  });

  it('does not steal an order already owned by someone else', async () => {
    let updated = false;
    const result = await claimGuestCheckoutOrder({
      uid: UID,
      orderId: ORDER_ID,
      conversionNonce: NONCE,
      getOrder: async () => ({
        exists: true,
        data: { ...guestOrder, customerUid: OTHER_UID },
      }),
      updateOrder: async () => {
        updated = true;
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'owned');
    assert.equal(updated, false);
  });

  it('does not query or load any order other than the given id', async () => {
    const loaded = [];
    await claimGuestCheckoutOrder({
      uid: UID,
      orderId: ORDER_ID,
      conversionNonce: NONCE,
      getOrder: async (collectionName, orderId) => {
        loaded.push({ collectionName, orderId });
        return { exists: true, data: { ...guestOrder } };
      },
      updateOrder: async () => {},
    });
    assert.deepEqual(loaded, [{ collectionName: 'orders', orderId: ORDER_ID }]);
  });
});
