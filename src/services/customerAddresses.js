/**
 * Phase 1A.10 saved delivery addresses.
 *
 * Identity comes only from the Firebase Auth user.
 * Delivery mobile is independent from account mobile10.
 */

import {
  CUSTOMERS_COLLECTION,
  formatMaskedCustomerMobile,
  getCustomerIdentityFromUser,
  getCustomerProfile,
  isValidCustomerMobile10,
  updateCustomerProfile,
} from './customerProfile.js';
import { isAuthorizedAdminUser } from '../utils/adminAuth.js';

export const CUSTOMER_ADDRESSES_SUBCOLLECTION = 'addresses';
export const ACCOUNT_ADDRESSES_PATH = '/account/addresses';
export const MAX_CUSTOMER_ADDRESSES = 8;
export const ADDRESS_LABELS = ['Home', 'Office', 'Other'];
export const ADDRESS_FULL_NAME_MAX = 80;
export const ADDRESS_TEXT_MAX = 500;
export const ADDRESS_LANDMARK_MAX = 120;
export const ADDRESSES_UNAVAILABLE_MESSAGE =
  'Unable to save your address right now. You can keep shopping.';
export const ADDRESSES_LIMIT_MESSAGE =
  'You can save up to 8 delivery addresses.';

const DELETE_DEFAULT = null;

export const isValidAddressLabel = (label) => ADDRESS_LABELS.includes(label);

export const normalizeAddressText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
};

export const toStoredAddressLocation = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) return null;
  if (location.confirmed !== true) return null;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, confirmed: true };
};

export const buildCustomerAddressPayload = (input, addressId, timestamps) => {
  if (!addressId || typeof addressId !== 'string') return null;
  if (!timestamps?.createdAt || !timestamps?.updatedAt) return null;

  const label = input?.label;
  const fullName = normalizeAddressText(input?.fullName, ADDRESS_FULL_NAME_MAX);
  const mobile10 =
    typeof input?.mobile10 === 'string' ? input.mobile10.replace(/\D/g, '').slice(0, 10) : '';
  const address = normalizeAddressText(input?.address, ADDRESS_TEXT_MAX);
  const location = toStoredAddressLocation(input?.location);

  if (!isValidAddressLabel(label)) return null;
  if (!fullName) return null;
  if (!isValidCustomerMobile10(mobile10)) return null;
  if (!address) return null;
  if (!location) return null;

  const payload = {
    addressId,
    label,
    fullName,
    mobile10,
    address,
    location,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };

  if (Object.prototype.hasOwnProperty.call(input || {}, 'landmark') && input.landmark) {
    const landmark = normalizeAddressText(input.landmark, ADDRESS_LANDMARK_MAX);
    if (!landmark) return null;
    payload.landmark = landmark;
  }

  return payload;
};

const resolveAddressDeps = async (deps = {}) => {
  if (
    deps.db &&
    deps.doc &&
    deps.collection &&
    deps.getDoc &&
    deps.getDocs &&
    deps.setDoc &&
    deps.updateDoc &&
    deps.deleteDoc &&
    deps.serverTimestamp
  ) {
    return deps;
  }

  const [
    {
      collection,
      doc,
      getDoc,
      getDocs,
      setDoc,
      updateDoc,
      deleteDoc,
      serverTimestamp,
      deleteField,
    },
    { db },
  ] = await Promise.all([
    import('firebase/firestore'),
    import('../firebaseConfig.js'),
  ]);

  return {
    db: deps.db ?? db,
    collection: deps.collection ?? collection,
    doc: deps.doc ?? doc,
    getDoc: deps.getDoc ?? getDoc,
    getDocs: deps.getDocs ?? getDocs,
    setDoc: deps.setDoc ?? setDoc,
    updateDoc: deps.updateDoc ?? updateDoc,
    deleteDoc: deps.deleteDoc ?? deleteDoc,
    deleteField: deps.deleteField ?? deleteField,
    serverTimestamp: deps.serverTimestamp ?? serverTimestamp,
    generateId: deps.generateId,
  };
};

const skipIfNotCustomer = (user) => {
  if (!user) return { status: 'skipped', reason: 'missing-user' };
  if (isAuthorizedAdminUser(user)) return { status: 'skipped', reason: 'admin' };
  const identity = getCustomerIdentityFromUser(user);
  if (!identity) return { status: 'skipped', reason: 'invalid-uid' };
  return { identity };
};

const listAddressDocs = async (resolved, uid) => {
  const colRef = resolved.collection(
    resolved.db,
    CUSTOMERS_COLLECTION,
    uid,
    CUSTOMER_ADDRESSES_SUBCOLLECTION,
  );
  const snapshot = await resolved.getDocs(colRef);
  const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
  return docs.map((docSnap) => {
    const data = typeof docSnap?.data === 'function' ? docSnap.data() : {};
    return {
      ...(data && typeof data === 'object' ? data : {}),
      addressId: data?.addressId || docSnap?.id || '',
    };
  });
};

export const toCustomerAddressView = (address, defaultAddressId = '') => {
  if (!address || typeof address !== 'object') return null;
  return {
    addressId: address.addressId || '',
    label: address.label || '',
    fullName: address.fullName || '',
    mobileMasked: formatMaskedCustomerMobile(address.mobile10),
    address: address.address || '',
    landmark: address.landmark || '',
    locationConfirmed: address.location?.confirmed === true,
    isDefault: Boolean(defaultAddressId) && address.addressId === defaultAddressId,
  };
};

export const getCustomerAddresses = async (user, deps = {}) => {
  const gate = skipIfNotCustomer(user);
  if (!gate.identity) {
    return { ...gate, addresses: [], defaultAddressId: '' };
  }

  try {
    const resolved = await resolveAddressDeps(deps);
    const profileResult = await getCustomerProfile(user, deps);
    const defaultAddressId =
      profileResult.profile && typeof profileResult.profile.defaultAddressId === 'string'
        ? profileResult.profile.defaultAddressId
        : '';
    const addresses = await listAddressDocs(resolved, gate.identity.uid);
    const sorted = [...addresses].sort((a, b) => {
      if (a.addressId === defaultAddressId) return -1;
      if (b.addressId === defaultAddressId) return 1;
      return String(a.fullName || '').localeCompare(String(b.fullName || ''));
    });
    return { status: 'ok', addresses: sorted, defaultAddressId };
  } catch {
    return { status: 'unavailable', addresses: [], defaultAddressId: '' };
  }
};

export const createCustomerAddress = async (user, input, deps = {}) => {
  const gate = skipIfNotCustomer(user);
  if (!gate.identity) return gate;

  const resolved = await resolveAddressDeps(deps);
  try {
    const existing = await listAddressDocs(resolved, gate.identity.uid);
    if (existing.length >= MAX_CUSTOMER_ADDRESSES) {
      return { status: 'limit', reason: 'max-addresses' };
    }

    const colRef = resolved.collection(
      resolved.db,
      CUSTOMERS_COLLECTION,
      gate.identity.uid,
      CUSTOMER_ADDRESSES_SUBCOLLECTION,
    );
    const docRef = resolved.generateId
      ? { id: resolved.generateId(), path: colRef }
      : resolved.doc(colRef);
    const addressId = docRef.id;
    if (!addressId) return { status: 'unavailable' };

    const timestamp = resolved.serverTimestamp();
    const payload = buildCustomerAddressPayload(input, addressId, {
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (!payload) return { status: 'invalid' };

    const writeRef = resolved.generateId
      ? resolved.doc(
          resolved.db,
          CUSTOMERS_COLLECTION,
          gate.identity.uid,
          CUSTOMER_ADDRESSES_SUBCOLLECTION,
          addressId,
        )
      : docRef;
    await resolved.setDoc(writeRef, payload);

    const profileResult = await getCustomerProfile(user, deps);
    const hasDefault =
      typeof profileResult.profile?.defaultAddressId === 'string' &&
      profileResult.profile.defaultAddressId;
    if (!hasDefault) {
      await updateCustomerProfile(user, { defaultAddressId: addressId }, deps);
    }

    return { status: 'ok', address: payload };
  } catch {
    return { status: 'unavailable' };
  }
};

export const updateCustomerAddress = async (user, addressId, input, deps = {}) => {
  const gate = skipIfNotCustomer(user);
  if (!gate.identity) return gate;
  if (typeof addressId !== 'string' || !addressId) return { status: 'invalid' };

  try {
    const resolved = await resolveAddressDeps(deps);
    const existingList = await listAddressDocs(resolved, gate.identity.uid);
    const existing = existingList.find((item) => item.addressId === addressId);
    if (!existing) return { status: 'missing' };

    const payload = buildCustomerAddressPayload(
      { ...existing, ...input, addressId },
      addressId,
      {
        createdAt: existing.createdAt,
        updatedAt: resolved.serverTimestamp(),
      },
    );
    if (!payload) return { status: 'invalid' };

    const ref = resolved.doc(
      resolved.db,
      CUSTOMERS_COLLECTION,
      gate.identity.uid,
      CUSTOMER_ADDRESSES_SUBCOLLECTION,
      addressId,
    );
    const { createdAt: _createdAt, ...updatable } = payload;
    if (!payload.landmark && existing.landmark && typeof resolved.deleteField === 'function') {
      updatable.landmark = resolved.deleteField();
    }
    await resolved.updateDoc(ref, updatable);
    return { status: 'ok', address: payload };
  } catch {
    return { status: 'unavailable' };
  }
};

export const setDefaultCustomerAddress = async (user, addressId, deps = {}) => {
  const gate = skipIfNotCustomer(user);
  if (!gate.identity) return gate;
  if (typeof addressId !== 'string' || !addressId) return { status: 'invalid' };

  try {
    const resolved = await resolveAddressDeps(deps);
    const existing = await listAddressDocs(resolved, gate.identity.uid);
    if (!existing.some((item) => item.addressId === addressId)) {
      return { status: 'missing' };
    }
    return updateCustomerProfile(user, { defaultAddressId: addressId }, deps);
  } catch {
    return { status: 'unavailable' };
  }
};

export const deleteCustomerAddress = async (user, addressId, deps = {}) => {
  const gate = skipIfNotCustomer(user);
  if (!gate.identity) return gate;
  if (typeof addressId !== 'string' || !addressId) return { status: 'invalid' };

  try {
    const resolved = await resolveAddressDeps(deps);
    const existing = await listAddressDocs(resolved, gate.identity.uid);
    if (!existing.some((item) => item.addressId === addressId)) {
      return { status: 'missing' };
    }

    const ref = resolved.doc(
      resolved.db,
      CUSTOMERS_COLLECTION,
      gate.identity.uid,
      CUSTOMER_ADDRESSES_SUBCOLLECTION,
      addressId,
    );
    await resolved.deleteDoc(ref);

    const remaining = existing.filter((item) => item.addressId !== addressId);
    const profileResult = await getCustomerProfile(user, deps);
    const currentDefault = profileResult.profile?.defaultAddressId;
    if (currentDefault === addressId) {
      const nextDefault = remaining[0]?.addressId || DELETE_DEFAULT;
      await updateCustomerProfile(user, { defaultAddressId: nextDefault }, deps);
    }

    return { status: 'ok' };
  } catch {
    return { status: 'unavailable' };
  }
};
