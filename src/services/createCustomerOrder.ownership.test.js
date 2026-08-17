import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyOrderCustomerOwnership,
  resolveOrderCustomerUid,
} from './orderCustomerOwnership.js';

const VALID_MOBILE10 = '9876543210';
const VALID_UID = `phone_91${VALID_MOBILE10}`;
const OTHER_UID = 'phone_919999999999';
const DELIVERY_MOBILE = '9123456789';

const baseOrder = {
  orderId: 'ORDER_123',
  items: [{ name: 'Pomfret', qty: 1, rate: 500 }],
  totalPrice: 250,
  amountPaise: 25000,
  subtotal: 250,
  discount: 0,
  deliveryCharge: 0,
  deliveryChargePaise: 0,
  offerId: null,
  paymentStatus: 'PENDING_CONFIRMATION',
  paidVerified: false,
  orderStatus: 'Processing',
  transactionId: 'UTR123',
  paymentRef: 'PAY123',
  deliveryInfo: {
    customerName: 'Guest Name',
    mobileNumber: DELIVERY_MOBILE,
    address: 'Test address',
    mobileVerified: true,
  },
  timestamp: '2026-08-17T00:00:00.000Z',
};

describe('createCustomerOrder ownership', () => {
  it('omits customerUid for a guest order and keeps existing fields', () => {
    const result = applyOrderCustomerOwnership(baseOrder, null);
    assert.equal(Object.hasOwn(result, 'customerUid'), false);
    assert.equal(result.orderId, baseOrder.orderId);
    assert.equal(result.paymentStatus, 'PENDING_CONFIRMATION');
    assert.equal(result.paidVerified, false);
    assert.equal(result.totalPrice, 250);
    assert.equal(result.deliveryInfo.mobileNumber, DELIVERY_MOBILE);
    assert.deepEqual(result.items, baseOrder.items);
  });

  it('sets customerUid to auth.currentUser.uid for a valid customer', () => {
    const result = applyOrderCustomerOwnership(baseOrder, { uid: VALID_UID });
    assert.equal(result.customerUid, VALID_UID);
    assert.equal(resolveOrderCustomerUid({ uid: VALID_UID }), VALID_UID);
  });

  it('strips a malicious supplied customerUid and writes the authenticated UID', () => {
    const result = applyOrderCustomerOwnership(
      { ...baseOrder, customerUid: OTHER_UID },
      { uid: VALID_UID },
    );
    assert.equal(result.customerUid, VALID_UID);
    assert.notEqual(result.customerUid, OTHER_UID);
  });

  it('does not let a customer choose another customer UID', () => {
    const result = applyOrderCustomerOwnership(
      { ...baseOrder, customerUid: OTHER_UID },
      { uid: VALID_UID },
    );
    assert.equal(result.customerUid, VALID_UID);
  });

  it('omits customerUid for an Admin', () => {
    const result = applyOrderCustomerOwnership(baseOrder, {
      uid: 'admin-firebase-uid',
      email: 'support@prnexusgroup.com',
    });
    assert.equal(Object.hasOwn(result, 'customerUid'), false);
    assert.equal(
      resolveOrderCustomerUid({
        uid: VALID_UID,
        email: 'info@prnexusgroup.com',
      }),
      undefined,
    );
  });

  it('omits customerUid for an invalid non-customer Firebase user', () => {
    const result = applyOrderCustomerOwnership(baseOrder, { uid: 'google-user-123' });
    assert.equal(Object.hasOwn(result, 'customerUid'), false);
  });

  it('omits customerUid when there is no auth user', () => {
    assert.equal(Object.hasOwn(applyOrderCustomerOwnership(baseOrder, undefined), 'customerUid'), false);
    assert.equal(resolveOrderCustomerUid(null), undefined);
  });

  it('keeps delivery mobile independent from customerUid', () => {
    const result = applyOrderCustomerOwnership(baseOrder, { uid: VALID_UID });
    assert.equal(result.customerUid, VALID_UID);
    assert.equal(result.deliveryInfo.mobileNumber, DELIVERY_MOBILE);
    assert.notEqual(result.deliveryInfo.mobileNumber, VALID_MOBILE10);
  });

  it('does not change payment fields', () => {
    const result = applyOrderCustomerOwnership(baseOrder, { uid: VALID_UID });
    assert.equal(result.paymentStatus, baseOrder.paymentStatus);
    assert.equal(result.paidVerified, baseOrder.paidVerified);
    assert.equal(result.transactionId, baseOrder.transactionId);
    assert.equal(result.paymentRef, baseOrder.paymentRef);
    assert.equal(result.totalPrice, baseOrder.totalPrice);
    assert.equal(result.amountPaise, baseOrder.amountPaise);
  });

  it('never writes customerUid null', () => {
    const guest = applyOrderCustomerOwnership(
      { ...baseOrder, customerUid: null },
      null,
    );
    assert.equal(Object.hasOwn(guest, 'customerUid'), false);
    assert.notEqual(guest.customerUid, null);
  });
});
