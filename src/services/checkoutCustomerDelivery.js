/**
 * Phase 1A.11 checkout mapping for saved addresses and Auth-mobile proof.
 *
 * Identity comes only from the Firebase Auth user.
 * Saved-address mobile is never treated as verification by itself.
 */

import {
  formatMaskedCustomerMobile,
  getCustomerIdentityFromUser,
  isValidCustomerMobile10,
} from './customerProfile.js';
import { isCustomerUser } from './customerSession.js';

export const SAVED_ADDRESSES_LOAD_MESSAGE = 'Loading saved addresses...';
export const SAVED_ADDRESSES_UNAVAILABLE_MESSAGE =
  'Could not load saved addresses. You can enter delivery details below.';
export const ACCOUNT_MOBILE_VERIFIED_LABEL = 'Account mobile verified';

const digitsMobile10 = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

const toCheckoutMapsLinks = (lat, lng) => ({
  mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
  navigateUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
});

export const getAccountMobile10FromUser = (user) => {
  const identity = getCustomerIdentityFromUser(user);
  return identity?.mobile10 || '';
};

export const canSkipCheckoutOtpForAuthMobile = (user, deliveryMobile) => {
  if (!isCustomerUser(user)) return false;
  const accountMobile = getAccountMobile10FromUser(user);
  const mobile = digitsMobile10(deliveryMobile);
  if (!accountMobile || !isValidCustomerMobile10(mobile)) return false;
  return accountMobile === mobile;
};

export const toCheckoutLocationSnapshot = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) return null;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (location.confirmed !== true) return null;
  const links = toCheckoutMapsLinks(lat, lng);
  return {
    lat,
    lng,
    confirmed: true,
    mapsUrl: links.mapsUrl,
    navigateUrl: links.navigateUrl,
  };
};

export const toCheckoutDeliverySnapshot = (address) => {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null;
  const customerName =
    typeof address.fullName === 'string' ? address.fullName.trim() : '';
  const mobileNumber = digitsMobile10(address.mobile10);
  const addressText = typeof address.address === 'string' ? address.address.trim() : '';
  const location = toCheckoutLocationSnapshot(address.location);
  if (!customerName || !isValidCustomerMobile10(mobileNumber) || !addressText || !location) {
    return null;
  }
  return {
    customerName,
    mobileNumber,
    address: addressText,
    location,
  };
};

export const resolveDefaultSavedAddress = (addresses, defaultAddressId) => {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  if (typeof defaultAddressId === 'string' && defaultAddressId) {
    const matched = addresses.find((item) => item?.addressId === defaultAddressId);
    if (matched) return matched;
  }
  return null;
};

const shortenAddress = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= 72) return text;
  return `${text.slice(0, 69)}...`;
};

export const toCheckoutAddressCard = (address, selectedAddressId = '') => {
  if (!address || typeof address !== 'object') return null;
  return {
    addressId: address.addressId || '',
    label: address.label || '',
    fullName: address.fullName || '',
    mobileMasked: formatMaskedCustomerMobile(address.mobile10),
    address: shortenAddress(address.address),
    locationConfirmed: address.location?.confirmed === true,
    selected: Boolean(selectedAddressId) && address.addressId === selectedAddressId,
  };
};

export const isConfirmedCheckoutLocation = (location) => {
  if (!location || typeof location !== 'object') return false;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  return (
    location.confirmed === true &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
};

/**
 * Shared payment-gate check for CheckoutConfirmation and App.jsx.
 * Auth-match is recomputed from the Auth user. Saved addresses are not proof.
 */
export const isDeliveryReadyForPaymentGate = (user, deliveryInfo) => {
  if (!deliveryInfo || typeof deliveryInfo !== 'object' || Array.isArray(deliveryInfo)) {
    return false;
  }

  const customerName =
    typeof deliveryInfo.customerName === 'string' && deliveryInfo.customerName.trim();
  const address =
    typeof deliveryInfo.address === 'string' && deliveryInfo.address.trim();
  const mobile = digitsMobile10(deliveryInfo.mobileNumber);

  if (!customerName || !address || !isValidCustomerMobile10(mobile)) return false;
  if (!isConfirmedCheckoutLocation(deliveryInfo.location)) return false;

  if (canSkipCheckoutOtpForAuthMobile(user, mobile)) return true;

  return deliveryInfo.mobileVerified === true;
};
