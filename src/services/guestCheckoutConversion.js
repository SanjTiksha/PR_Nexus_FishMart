/**
 * Phase 1A.12 guest checkout → customer conversion helpers.
 *
 * Identity comes from the existing MSG91 session Function, not from
 * typed mobile, URL, or localStorage. Conversion nonce stays in memory
 * except for the guest order write.
 */

import { extractMsg91VerifiedToken } from '../utils/msg91VerifiedToken.js';
import { toStoredAddressLocation } from './customerAddresses.js';
import { isValidCustomerMobile10 } from './customerProfile.js';

export const CONVERSION_ACCOUNT_FAILED_MESSAGE =
  "Your order is confirmed. We couldn't create your account right now. You can continue as a guest.";
export const CONVERSION_ORDER_UNLINKED_MESSAGE =
  "Account created. We couldn't attach this order yet. You can still add the address later from Account → Addresses.";
export const CONVERSION_ADDRESS_FAILED_MESSAGE =
  "Account created. We couldn't save the address, but you can add it later from Account → Addresses.";

export const generateConversionNonce = (randomSource = globalThis.crypto) => {
  if (!randomSource || typeof randomSource.getRandomValues !== 'function') {
    return '';
  }
  const bytes = new Uint8Array(32);
  randomSource.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const isValidConversionNonce = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export const captureCheckoutVerifiedToken = (rawSuccess) => {
  try {
    return extractMsg91VerifiedToken(rawSuccess);
  } catch {
    return '';
  }
};

export const shouldOfferGuestConversion = (order, user) => {
  if (!order || typeof order !== 'object' || Array.isArray(order)) return false;
  if (typeof order.customerUid === 'string' && order.customerUid) return false;
  if (user && typeof user.uid === 'string' && /^phone_91[6-9]\d{9}$/.test(user.uid)) {
    return false;
  }
  return Boolean(order.orderId);
};

export const stripConversionSecrets = (order) => {
  if (!order || typeof order !== 'object' || Array.isArray(order)) return order;
  const {
    conversionNonce: _nonce,
    verifiedToken: _token,
    customToken: _custom,
    ...rest
  } = order;
  return rest;
};

/**
 * Synchronous lock for Save Address. begin() is sync so a second click
 * in the same tick cannot start another createCustomerAddress().
 * end() only after failure so the customer can retry.
 */
export const createSaveAddressInFlightGuard = () => {
  let inFlight = false;
  return {
    begin() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    end() {
      inFlight = false;
    },
  };
};

export const runSaveConvertedAddressOnce = async (guard, createAddress) => {
  if (!guard || typeof guard.begin !== 'function' || typeof createAddress !== 'function') {
    return { status: 'failed' };
  }
  if (!guard.begin()) {
    return { status: 'busy' };
  }
  try {
    const result = await createAddress();
    if (result && result.status === 'ok') {
      return { status: 'ok' };
    }
    if (typeof guard.end === 'function') guard.end();
    return { status: 'failed' };
  } catch {
    if (typeof guard.end === 'function') guard.end();
    return { status: 'failed' };
  }
};

export const toSavedAddressInputFromDelivery = (deliveryInfo) => {
  if (!deliveryInfo || typeof deliveryInfo !== 'object' || Array.isArray(deliveryInfo)) {
    return null;
  }

  const fullName =
    typeof deliveryInfo.customerName === 'string' ? deliveryInfo.customerName.trim() : '';
  const mobile10 = String(deliveryInfo.mobileNumber || '').replace(/\D/g, '').slice(0, 10);
  const address = typeof deliveryInfo.address === 'string' ? deliveryInfo.address.trim() : '';
  const location = toStoredAddressLocation(deliveryInfo.location);

  if (!fullName || !isValidCustomerMobile10(mobile10) || !address || !location) {
    return null;
  }

  const input = {
    label: 'Home',
    fullName,
    mobile10,
    address,
    location,
  };

  if (typeof deliveryInfo.landmark === 'string' && deliveryInfo.landmark.trim()) {
    input.landmark = deliveryInfo.landmark.trim();
  }

  return input;
};

export const exchangeVerifiedTokenForGuestConversion = async (
  { token, orderId, conversionNonce, sessionUrl },
  fetchImpl = fetch,
) => {
  const GENERIC_SESSION_ERROR = 'Unable to complete login. Please try again.';
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }
  if (typeof orderId !== 'string' || !orderId.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }
  if (!isValidConversionNonce(conversionNonce)) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_CUSTOMER_SESSION_URL
      : '';
  const url = typeof sessionUrl === 'string' && sessionUrl.trim() ? sessionUrl.trim() : envUrl;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  let response;
  try {
    response = await fetchImpl(url.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token.trim(),
        orderId: orderId.trim(),
        conversionNonce,
      }),
    });
  } catch {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  if (!response.ok) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  const customToken =
    body && typeof body === 'object' && !Array.isArray(body) ? body.customToken : '';
  if (typeof customToken !== 'string' || !customToken.trim()) {
    throw new Error(GENERIC_SESSION_ERROR);
  }

  return {
    customToken: customToken.trim(),
    orderLinked: body.orderLinked === true,
  };
};
