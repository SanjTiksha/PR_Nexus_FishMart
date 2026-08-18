'use strict';

const crypto = require('crypto');

const ORDERS_COLLECTION = 'orders';
const ORDER_ID_PATTERN = /^ORDER_[0-9]{10,16}$/;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;
const CUSTOMER_UID_PATTERN = /^phone_91[6-9][0-9]{9}$/;

const parseConversionRequest = (body) => {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { requested: false };
  }

  const hasOrderId = Object.prototype.hasOwnProperty.call(body, 'orderId');
  const hasNonce = Object.prototype.hasOwnProperty.call(body, 'conversionNonce');
  if (!hasOrderId && !hasNonce) {
    return { requested: false };
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const conversionNonce =
    typeof body.conversionNonce === 'string' ? body.conversionNonce.trim() : '';

  if (!ORDER_ID_PATTERN.test(orderId) || !NONCE_PATTERN.test(conversionNonce)) {
    return { requested: true, ok: false };
  }

  return { requested: true, ok: true, orderId, conversionNonce };
};

const timingSafeEqualString = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const digitsMobile10 = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

const mobile10FromCustomerUid = (uid) => {
  if (!CUSTOMER_UID_PATTERN.test(String(uid || ''))) return '';
  return String(uid).slice('phone_91'.length);
};

const deliveryMobileMatchesUid = (order, uid) => {
  const expected = mobile10FromCustomerUid(uid);
  if (!expected) return false;
  const deliveryMobile = digitsMobile10(order && order.deliveryInfo && order.deliveryInfo.mobileNumber);
  if (!deliveryMobile) return false;
  return deliveryMobile === expected;
};

/**
 * Link ONE guest order to the MSG91-verified customer uid.
 * Does not query by mobile. Does not change payment or item fields.
 */
const claimGuestCheckoutOrder = async ({
  uid,
  orderId,
  conversionNonce,
  getOrder,
  updateOrder,
}) => {
  if (!CUSTOMER_UID_PATTERN.test(String(uid || ''))) {
    return { ok: false, reason: 'invalid-uid' };
  }
  if (!ORDER_ID_PATTERN.test(String(orderId || ''))) {
    return { ok: false, reason: 'invalid-order' };
  }
  if (!NONCE_PATTERN.test(String(conversionNonce || ''))) {
    return { ok: false, reason: 'invalid-nonce' };
  }
  if (typeof getOrder !== 'function' || typeof updateOrder !== 'function') {
    return { ok: false, reason: 'unavailable' };
  }

  let snapshot;
  try {
    snapshot = await getOrder(ORDERS_COLLECTION, orderId);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (!snapshot || snapshot.exists !== true || !snapshot.data || typeof snapshot.data !== 'object') {
    return { ok: false, reason: 'missing' };
  }

  const order = snapshot.data;
  const existingUid = typeof order.customerUid === 'string' ? order.customerUid : '';
  if (existingUid) {
    if (existingUid === uid) {
      return { ok: true, reason: 'already-linked' };
    }
    return { ok: false, reason: 'owned' };
  }

  const storedNonce = typeof order.conversionNonce === 'string' ? order.conversionNonce : '';
  if (!timingSafeEqualString(storedNonce, conversionNonce)) {
    return { ok: false, reason: 'nonce' };
  }

  if (!deliveryMobileMatchesUid(order, uid)) {
    return { ok: false, reason: 'mobile-mismatch' };
  }

  try {
    await updateOrder(ORDERS_COLLECTION, orderId, {
      customerUid: uid,
      conversionNonce: null,
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  return { ok: true, reason: 'linked' };
};

module.exports = {
  ORDERS_COLLECTION,
  ORDER_ID_PATTERN,
  NONCE_PATTERN,
  parseConversionRequest,
  claimGuestCheckoutOrder,
};
