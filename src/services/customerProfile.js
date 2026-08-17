/**
 * Phase 1A.7 customer profile helpers.
 *
 * Auth UID is the identity source of truth.
 * Firestore customers/{uid} is create-or-read only.
 * Does not use localStorage, sessionStorage, query params, or typed mobile input.
 */

import { isAuthorizedAdminUser } from '../utils/adminAuth.js';

export const CUSTOMERS_COLLECTION = 'customers';
export const CUSTOMER_PROFILE_SCHEMA_VERSION = 1;
export const CUSTOMER_UID_PATTERN = /^phone_91[6-9]\d{9}$/;
export const CUSTOMER_MOBILE10_PATTERN = /^[6-9]\d{9}$/;

export const CUSTOMER_PROFILE_FIELDS = [
  'uid',
  'mobile10',
  'createdAt',
  'updatedAt',
  'schemaVersion',
];

export const FROZEN_CUSTOMER_PROFILE_FIELDS = [
  'uid',
  'mobile10',
  'createdAt',
  'schemaVersion',
];

export const PROFILE_SAVE_UNAVAILABLE_MESSAGE =
  'Unable to save your profile right now. You can keep shopping.';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export const isValidCustomerUid = (uid) =>
  typeof uid === 'string' && CUSTOMER_UID_PATTERN.test(uid);

export const isValidCustomerMobile10 = (mobile10) =>
  typeof mobile10 === 'string' && CUSTOMER_MOBILE10_PATTERN.test(mobile10);

/**
 * Derive verified mobile10 from Firebase Auth UID only.
 * UID format: phone_91[6-9][0-9]{9}
 */
export const parseCustomerIdentityFromUid = (uid) => {
  if (!isValidCustomerUid(uid)) return null;
  const mobile10 = uid.slice('phone_91'.length);
  if (!isValidCustomerMobile10(mobile10)) return null;
  if (uid !== `phone_91${mobile10}`) return null;
  return { uid, mobile10 };
};

/**
 * Account display: +91 XXXXX XXXXX grouping, first 2 and last 2 digits visible.
 * Never returns an unmasked 10-digit mobile.
 */
export const formatMaskedCustomerMobile = (mobile10) => {
  if (!isValidCustomerMobile10(mobile10)) return '';
  return `+91 ${mobile10.slice(0, 2)}XXX XXX${mobile10.slice(-2)}`;
};

export const getCustomerIdentityFromUser = (user) => {
  if (!user) return null;
  if (isAuthorizedAdminUser(user)) return null;
  return parseCustomerIdentityFromUid(user.uid);
};

export const buildCustomerProfileCreatePayload = (identity, serverTimestampFn) => {
  if (!identity?.uid || !identity?.mobile10) return null;
  if (!isValidCustomerUid(identity.uid)) return null;
  if (!isValidCustomerMobile10(identity.mobile10)) return null;
  if (identity.uid !== `phone_91${identity.mobile10}`) return null;
  if (typeof serverTimestampFn !== 'function') return null;

  const timestamp = serverTimestampFn();
  return {
    uid: identity.uid,
    mobile10: identity.mobile10,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: CUSTOMER_PROFILE_SCHEMA_VERSION,
  };
};

export const wouldOverwriteFrozenFields = (existing, incoming) => {
  if (!existing || !incoming) return false;
  return FROZEN_CUSTOMER_PROFILE_FIELDS.some(
    (key) => hasOwn(incoming, key) && incoming[key] !== existing[key],
  );
};

const isAlreadyCreatedError = (error) => {
  const code = typeof error?.code === 'string' ? error.code : '';
  return (
    code === 'already-exists' ||
    code === 'permission-denied' ||
    code.endsWith('/already-exists') ||
    code.endsWith('/permission-denied')
  );
};

const resolveProfileDeps = async (deps = {}) => {
  if (deps.doc && deps.getDoc && deps.setDoc && deps.serverTimestamp && deps.db) {
    return deps;
  }

  const [{ doc, getDoc, setDoc, serverTimestamp }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('../firebaseConfig.js'),
  ]);

  return {
    doc: deps.doc ?? doc,
    getDoc: deps.getDoc ?? getDoc,
    setDoc: deps.setDoc ?? setDoc,
    serverTimestamp: deps.serverTimestamp ?? serverTimestamp,
    db: deps.db ?? db,
  };
};

const readProfileSnapshot = async (getDocFn, ref) => {
  const snapshot = await getDocFn(ref);
  if (!snapshot || typeof snapshot.exists !== 'function' || !snapshot.exists()) {
    return null;
  }
  const data = typeof snapshot.data === 'function' ? snapshot.data() : null;
  return data && typeof data === 'object' ? data : null;
};

/**
 * Create-only get-or-create for customers/{uid}.
 * Fail-soft: never signs out, never overwrites frozen fields.
 */
export const ensureCustomerProfile = async (user, deps = {}) => {
  const identity = getCustomerIdentityFromUser(user);
  if (!user) {
    return { status: 'skipped', reason: 'missing-user' };
  }
  if (isAuthorizedAdminUser(user)) {
    return { status: 'skipped', reason: 'admin' };
  }
  if (!identity) {
    return { status: 'skipped', reason: 'invalid-uid' };
  }

  try {
    const resolved = await resolveProfileDeps(deps);
    const ref = resolved.doc(resolved.db, CUSTOMERS_COLLECTION, identity.uid);
    const existing = await readProfileSnapshot(resolved.getDoc, ref);
    if (existing) {
      return { status: 'existing', profile: existing };
    }

    const payload = buildCustomerProfileCreatePayload(
      identity,
      resolved.serverTimestamp,
    );
    if (!payload) {
      return { status: 'unavailable' };
    }

    try {
      await resolved.setDoc(ref, payload);
      return { status: 'created', profile: payload };
    } catch (writeError) {
      if (isAlreadyCreatedError(writeError)) {
        const raced = await readProfileSnapshot(resolved.getDoc, ref);
        if (raced) {
          return { status: 'existing', profile: raced };
        }
      }
      return { status: 'unavailable' };
    }
  } catch {
    return { status: 'unavailable' };
  }
};
