import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_MOBILE_VERIFIED_LABEL,
  canSkipCheckoutOtpForAuthMobile,
  getAccountMobile10FromUser,
  isDeliveryReadyForPaymentGate,
  resolveDefaultSavedAddress,
  toCheckoutAddressCard,
  toCheckoutDeliverySnapshot,
} from './checkoutCustomerDelivery.js';

const ACCOUNT_MOBILE = '9876543210';
const OTHER_MOBILE = '9123456789';
const CUSTOMER_USER = { uid: `phone_91${ACCOUNT_MOBILE}` };
const ADMIN_USER = { uid: 'admin-1', email: 'support@prnexusgroup.com' };

const confirmedLocation = { lat: 18.52, lng: 73.85, confirmed: true };

const savedHome = {
  addressId: 'addr_home',
  label: 'Home',
  fullName: 'Pavan',
  mobile10: ACCOUNT_MOBILE,
  address: '12 FC Road, Pune',
  location: confirmedLocation,
};

const savedOffice = {
  addressId: 'addr_office',
  label: 'Office',
  fullName: 'Office Desk',
  mobile10: OTHER_MOBILE,
  address: 'Baner, Pune',
  location: confirmedLocation,
};

const readyDelivery = {
  customerName: 'Pavan',
  mobileNumber: ACCOUNT_MOBILE,
  address: '12 FC Road, Pune',
  location: confirmedLocation,
  mobileVerified: true,
};

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'checkoutCustomerDelivery.js'),
  'utf8',
);
const checkoutSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/CheckoutConfirmation.jsx'),
  'utf8',
);
const appSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../App.jsx'),
  'utf8',
);

describe('checkout Auth-mobile match', () => {
  it('skips OTP only for a customer whose Auth mobile equals delivery mobile', () => {
    assert.equal(getAccountMobile10FromUser(CUSTOMER_USER), ACCOUNT_MOBILE);
    assert.equal(canSkipCheckoutOtpForAuthMobile(CUSTOMER_USER, ACCOUNT_MOBILE), true);
    assert.equal(canSkipCheckoutOtpForAuthMobile(CUSTOMER_USER, OTHER_MOBILE), false);
    assert.equal(canSkipCheckoutOtpForAuthMobile(null, ACCOUNT_MOBILE), false);
    assert.equal(canSkipCheckoutOtpForAuthMobile(ADMIN_USER, ACCOUNT_MOBILE), false);
    assert.equal(ACCOUNT_MOBILE_VERIFIED_LABEL, 'Account mobile verified');
    assert.equal(ACCOUNT_MOBILE_VERIFIED_LABEL.includes('Saved'), false);
  });

  it('does not use URL, storage, or caller UID as identity', () => {
    assert.equal(source.includes('localStorage'), false);
    assert.equal(source.includes('sessionStorage'), false);
    assert.equal(source.includes('searchParams'), false);
    assert.equal(source.includes('window.location'), false);
  });
});

describe('saved address snapshot', () => {
  it('maps a saved address into existing deliveryInfo fields', () => {
    const snapshot = toCheckoutDeliverySnapshot(savedHome);
    assert.equal(snapshot.customerName, 'Pavan');
    assert.equal(snapshot.mobileNumber, ACCOUNT_MOBILE);
    assert.equal(snapshot.address, '12 FC Road, Pune');
    assert.equal(snapshot.location.confirmed, true);
    assert.equal(Object.hasOwn(snapshot, 'addressId'), false);
    assert.equal(Object.hasOwn(snapshot, 'selectedAddressId'), false);
    assert.equal(Object.hasOwn(snapshot, 'customerUid'), false);
  });

  it('rejects unconfirmed or incomplete saved addresses', () => {
    assert.equal(
      toCheckoutDeliverySnapshot({
        ...savedHome,
        location: { ...confirmedLocation, confirmed: false },
      }),
      null,
    );
    assert.equal(toCheckoutDeliverySnapshot({ ...savedHome, fullName: '  ' }), null);
  });

  it('uses defaultAddressId only when that address still exists', () => {
    const addresses = [savedHome, savedOffice];
    assert.equal(resolveDefaultSavedAddress(addresses, 'addr_home'), savedHome);
    assert.equal(resolveDefaultSavedAddress(addresses, 'deleted'), null);
    assert.equal(resolveDefaultSavedAddress([], 'addr_home'), null);
    assert.equal(resolveDefaultSavedAddress(addresses, ''), null);
  });

  it('does not fall back to another saved address when the default is missing', () => {
    assert.equal(resolveDefaultSavedAddress([savedOffice], 'addr_home'), null);
  });

  it('shows a compact card without treating saved mobile as verified', () => {
    const card = toCheckoutAddressCard(savedOffice, 'addr_office');
    assert.equal(card.label, 'Office');
    assert.equal(card.fullName, 'Office Desk');
    assert.equal(card.selected, true);
    assert.equal(card.locationConfirmed, true);
    assert.equal(card.mobileMasked.includes('91'), true);
    assert.equal(card.mobileMasked.includes(OTHER_MOBILE), false);
  });
});

describe('payment gates', () => {
  it('allows Auth-match without trusting a saved-address verified flag', () => {
    assert.equal(
      isDeliveryReadyForPaymentGate(CUSTOMER_USER, {
        ...readyDelivery,
        mobileVerified: false,
      }),
      true,
    );
  });

  it('requires MSG91-style mobileVerified for guests and different delivery mobiles', () => {
    assert.equal(isDeliveryReadyForPaymentGate(null, readyDelivery), true);
    assert.equal(
      isDeliveryReadyForPaymentGate(null, { ...readyDelivery, mobileVerified: false }),
      false,
    );
    assert.equal(
      isDeliveryReadyForPaymentGate(CUSTOMER_USER, {
        ...readyDelivery,
        mobileNumber: OTHER_MOBILE,
        mobileVerified: false,
      }),
      false,
    );
    assert.equal(
      isDeliveryReadyForPaymentGate(CUSTOMER_USER, {
        ...readyDelivery,
        mobileNumber: OTHER_MOBILE,
        mobileVerified: true,
      }),
      true,
    );
    assert.equal(isDeliveryReadyForPaymentGate(ADMIN_USER, readyDelivery), true);
    assert.equal(
      isDeliveryReadyForPaymentGate(ADMIN_USER, { ...readyDelivery, mobileVerified: false }),
      false,
    );
  });

  it('rejects missing name, address, or unconfirmed location', () => {
    assert.equal(
      isDeliveryReadyForPaymentGate(CUSTOMER_USER, { ...readyDelivery, customerName: '' }),
      false,
    );
    assert.equal(
      isDeliveryReadyForPaymentGate(CUSTOMER_USER, { ...readyDelivery, address: '' }),
      false,
    );
    assert.equal(
      isDeliveryReadyForPaymentGate(CUSTOMER_USER, {
        ...readyDelivery,
        location: { lat: 18.52, lng: 73.85, confirmed: false },
      }),
      false,
    );
  });

  it('wires checkout and App payment gates to the shared helper', () => {
    assert.match(checkoutSource, /isDeliveryReadyForPaymentGate/);
    assert.match(checkoutSource, /getCustomerAddresses/);
    assert.match(checkoutSource, /ACCOUNT_MOBILE_VERIFIED_LABEL/);
    assert.match(checkoutSource, /Use another address/);
    assert.match(appSource, /isDeliveryReadyForPaymentGate/);
    assert.match(appSource, /auth\.currentUser/);
    assert.match(appSource, /from '\.\/firebaseConfig'/);
    assert.equal(appSource.includes('initializeApp'), false);
    assert.equal(appSource.includes('getAuth('), false);
    assert.equal(checkoutSource.includes('selectedAddressId:'), false);
    assert.equal(appSource.includes('selectedAddressId'), false);
    assert.equal(checkoutSource.includes('createCustomerAddress'), false);
    assert.equal(checkoutSource.includes('updateCustomerAddress'), false);
    assert.equal(checkoutSource.includes('onSnapshot'), false);
  });
});
