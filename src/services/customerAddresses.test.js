import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_ADDRESSES_PATH,
  ADDRESS_LABELS,
  MAX_CUSTOMER_ADDRESSES,
  buildCustomerAddressPayload,
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  setDefaultCustomerAddress,
  toStoredAddressLocation,
  updateCustomerAddress,
} from './customerAddresses.js';

const VALID_MOBILE10 = '9876543210';
const VALID_UID = `phone_91${VALID_MOBILE10}`;
const OTHER_UID = 'phone_919999999999';
const VALID_USER = { uid: VALID_UID };
const OTHER_USER = { uid: OTHER_UID };
const DELIVERY_MOBILE = '9123456789';

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'customerAddresses.js');
const source = readFileSync(sourcePath, 'utf8');
const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../App.jsx'), 'utf8');
const accountSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../pages/Account.jsx'),
  'utf8',
);
const pageSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../pages/CustomerAddresses.jsx'),
  'utf8',
);
const checkoutSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/CheckoutConfirmation.jsx'),
  'utf8',
);

const validLocation = { lat: 18.52, lng: 73.85, confirmed: true };

const validInput = {
  label: 'Home',
  fullName: 'Ajay Kumar',
  mobile10: DELIVERY_MOBILE,
  address: '12 FC Road, Pune',
  landmark: 'Near cafe',
  location: validLocation,
};

const createMemoryDeps = () => {
  const store = new Map();
  const writes = [];
  let nextId = 0;

  const keyOf = (ref) => (Array.isArray(ref?.segments) ? ref.segments.join('/') : '');

  const applyPatch = (existing, data) => {
    const next = { ...(existing || {}) };
    for (const [key, value] of Object.entries(data || {})) {
      if (value && value.__deleteField) delete next[key];
      else next[key] = value;
    }
    return next;
  };

  return {
    store,
    writes,
    db: { name: 'memory' },
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    deleteField: () => ({ __deleteField: true }),
    generateId: () => `addr_${++nextId}`,
    collection: (_db, ...segments) => ({ __col: true, segments }),
    doc: (first, ...rest) => {
      if (first?.__col && rest.length === 0) {
        const id = `addr_${++nextId}`;
        return { segments: [...first.segments, id], id };
      }
      return { segments: rest, id: rest[rest.length - 1] };
    },
    getDoc: async (ref) => {
      const existing = store.get(keyOf(ref));
      return {
        exists: () => existing != null,
        data: () => existing ?? null,
      };
    },
    getDocs: async (colRef) => {
      const prefix = `${colRef.segments.join('/')}/`;
      const docs = [];
      for (const [key, value] of store.entries()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        docs.push({
          id: rest,
          data: () => value,
        });
      }
      return { docs };
    },
    setDoc: async (ref, data) => {
      writes.push({ type: 'set', path: keyOf(ref), data });
      store.set(keyOf(ref), data);
    },
    updateDoc: async (ref, data) => {
      writes.push({ type: 'update', path: keyOf(ref), data });
      const existing = store.get(keyOf(ref));
      if (!existing) {
        const error = new Error('not-found');
        error.code = 'not-found';
        throw error;
      }
      store.set(keyOf(ref), applyPatch(existing, data));
    },
    deleteDoc: async (ref) => {
      writes.push({ type: 'delete', path: keyOf(ref) });
      store.delete(keyOf(ref));
    },
  };
};

const seedProfile = (deps, uid = VALID_UID, extra = {}) => {
  deps.store.set(`customers/${uid}`, {
    uid,
    mobile10: uid.slice('phone_91'.length),
    createdAt: 'CREATED',
    updatedAt: 'UPDATED',
    schemaVersion: 1,
    ...extra,
  });
};

describe('address validation', () => {
  it('accepts a checkout-compatible confirmed location and strips extras', () => {
    const stored = toStoredAddressLocation({
      ...validLocation,
      mapsUrl: 'https://maps.google.com/?q=18.52,73.85',
      source: 'map',
    });
    assert.deepEqual(stored, validLocation);
  });

  it('rejects unconfirmed or invalid locations', () => {
    assert.equal(toStoredAddressLocation({ ...validLocation, confirmed: false }), null);
    assert.equal(toStoredAddressLocation({ lat: 18.52, lng: 73.85 }), null);
    assert.equal(toStoredAddressLocation(null), null);
  });

  it('requires name, Indian mobile, address, and label', () => {
    const timestamps = { createdAt: 'C', updatedAt: 'U' };
    assert.ok(buildCustomerAddressPayload(validInput, 'addr_1', timestamps));
    assert.equal(
      buildCustomerAddressPayload({ ...validInput, fullName: '  ' }, 'addr_1', timestamps),
      null,
    );
    assert.equal(
      buildCustomerAddressPayload({ ...validInput, address: '' }, 'addr_1', timestamps),
      null,
    );
    assert.equal(
      buildCustomerAddressPayload({ ...validInput, mobile10: '1234567890' }, 'addr_1', timestamps),
      null,
    );
    assert.equal(
      buildCustomerAddressPayload({ ...validInput, label: 'Warehouse' }, 'addr_1', timestamps),
      null,
    );
    assert.deepEqual(ADDRESS_LABELS, ['Home', 'Office', 'Other']);
  });

  it('allows delivery mobile to differ from the account mobile', () => {
    const payload = buildCustomerAddressPayload(validInput, 'addr_1', {
      createdAt: 'C',
      updatedAt: 'U',
    });
    assert.equal(payload.mobile10, DELIVERY_MOBILE);
    assert.notEqual(payload.mobile10, VALID_MOBILE10);
    assert.equal(Object.hasOwn(payload, 'customerMobile10'), false);
    assert.equal(Object.hasOwn(payload, 'customerUid'), false);
    assert.equal(Object.hasOwn(payload, 'isDefault'), false);
  });
});

describe('customerAddresses service', () => {
  it('creates, reads, updates, and deletes own addresses', async () => {
    const deps = createMemoryDeps();
    seedProfile(deps);

    const created = await createCustomerAddress(VALID_USER, validInput, deps);
    assert.equal(created.status, 'ok');
    assert.equal(created.address.label, 'Home');
    assert.equal(created.address.addressId.startsWith('addr_'), true);
    assert.equal(deps.store.get(`customers/${VALID_UID}`).defaultAddressId, created.address.addressId);

    const listed = await getCustomerAddresses(VALID_USER, deps);
    assert.equal(listed.status, 'ok');
    assert.equal(listed.addresses.length, 1);
    assert.equal(listed.defaultAddressId, created.address.addressId);

    const updated = await updateCustomerAddress(
      VALID_USER,
      created.address.addressId,
      { ...validInput, fullName: 'Office Reception', label: 'Office' },
      deps,
    );
    assert.equal(updated.status, 'ok');
    assert.equal(updated.address.fullName, 'Office Reception');
    assert.equal(updated.address.label, 'Office');
    assert.equal(updated.address.createdAt, 'SERVER_TIMESTAMP');
    assert.equal(Object.hasOwn(updated.address, 'isDefault'), false);
    assert.equal(
      deps.store.get(`customers/${VALID_UID}`).defaultAddressId,
      created.address.addressId,
    );

    const deleted = await deleteCustomerAddress(VALID_USER, created.address.addressId, deps);
    assert.equal(deleted.status, 'ok');
    const afterDelete = await getCustomerAddresses(VALID_USER, deps);
    assert.equal(afterDelete.addresses.length, 0);
    assert.equal(Object.hasOwn(deps.store.get(`customers/${VALID_UID}`), 'defaultAddressId'), false);
  });

  it('does not use a caller-supplied uid and cannot touch another customer', async () => {
    const deps = createMemoryDeps();
    seedProfile(deps);
    seedProfile(deps, OTHER_UID);
    await createCustomerAddress(VALID_USER, validInput, deps);

    const otherCreate = await createCustomerAddress(OTHER_USER, { ...validInput, label: 'Office' }, deps);
    assert.equal(otherCreate.status, 'ok');

    const listed = await getCustomerAddresses(
      { uid: VALID_UID, requestedUid: OTHER_UID },
      deps,
    );
    assert.equal(listed.addresses.length, 1);
    assert.equal(listed.addresses[0].label, 'Home');

    const crossDelete = await deleteCustomerAddress(VALID_USER, otherCreate.address.addressId, deps);
    assert.equal(crossDelete.status, 'missing');
    assert.equal(
      deps.store.has(`customers/${OTHER_UID}/addresses/${otherCreate.address.addressId}`),
      true,
    );
  });

  it('rejects invalid writes before talking to Firestore', async () => {
    const deps = createMemoryDeps();
    seedProfile(deps);
    assert.equal(
      (await createCustomerAddress(VALID_USER, { ...validInput, mobile10: '5876543210' }, deps)).status,
      'invalid',
    );
    assert.equal(
      (await createCustomerAddress(VALID_USER, { ...validInput, fullName: '' }, deps)).status,
      'invalid',
    );
    assert.equal(
      (await createCustomerAddress(VALID_USER, { ...validInput, address: '   ' }, deps)).status,
      'invalid',
    );
    assert.equal(
      (await createCustomerAddress(
        VALID_USER,
        { ...validInput, location: { ...validLocation, confirmed: false } },
        deps,
      )).status,
      'invalid',
    );
    assert.equal(
      (await createCustomerAddress(VALID_USER, { ...validInput, label: 'Shop' }, deps)).status,
      'invalid',
    );
    assert.equal(deps.writes.length, 0);
  });

  it('rejects unauthenticated access', async () => {
    const deps = createMemoryDeps();
    const listed = await getCustomerAddresses(null, deps);
    assert.equal(listed.status, 'skipped');
    assert.equal(listed.reason, 'missing-user');
    const created = await createCustomerAddress(undefined, validInput, deps);
    assert.equal(created.status, 'skipped');
  });

  it('supports multiple addresses and a single default pointer', async () => {
    const deps = createMemoryDeps();
    seedProfile(deps);
    const first = await createCustomerAddress(VALID_USER, validInput, deps);
    const second = await createCustomerAddress(
      VALID_USER,
      { ...validInput, label: 'Office', fullName: 'Office Desk' },
      deps,
    );
    assert.equal(first.status, 'ok');
    assert.equal(second.status, 'ok');
    assert.equal(
      deps.store.get(`customers/${VALID_UID}`).defaultAddressId,
      first.address.addressId,
    );

    const switched = await setDefaultCustomerAddress(VALID_USER, second.address.addressId, deps);
    assert.equal(switched.status, 'ok');
    assert.equal(
      deps.store.get(`customers/${VALID_UID}`).defaultAddressId,
      second.address.addressId,
    );

    await deleteCustomerAddress(VALID_USER, second.address.addressId, deps);
    assert.equal(
      deps.store.get(`customers/${VALID_UID}`).defaultAddressId,
      first.address.addressId,
    );
  });

  it('enforces the saved-address cap in the application', async () => {
    const deps = createMemoryDeps();
    seedProfile(deps);
    for (let i = 0; i < MAX_CUSTOMER_ADDRESSES; i += 1) {
      const result = await createCustomerAddress(
        VALID_USER,
        { ...validInput, fullName: `Person ${i}` },
        deps,
      );
      assert.equal(result.status, 'ok');
    }
    const overflow = await createCustomerAddress(VALID_USER, validInput, deps);
    assert.equal(overflow.status, 'limit');
  });

  it('does not read web storage or call checkout/order/OTP services', () => {
    assert.equal(source.includes('localStorage'), false);
    assert.equal(source.includes('sessionStorage'), false);
    assert.equal(source.includes('searchParams'), false);
    assert.equal(source.includes('msg91'), false);
    assert.equal(source.includes('createCustomerOrder'), false);
    assert.equal(source.includes('customerMsg91Session'), false);
    assert.equal(ACCOUNT_ADDRESSES_PATH, '/account/addresses');
    assert.match(appSource, /path="\/account\/addresses"/);
    assert.match(accountSource, /to="\/account\/addresses"/);
    assert.match(pageSource, /getAccountRedirectPath/);
    assert.equal(pageSource.includes('createCustomerOrder'), false);
    assert.match(checkoutSource, /getCustomerAddresses/);
    assert.equal(checkoutSource.includes('createCustomerAddress'), false);
  });
});

describe('edit address default selection', () => {
  it('shows a 48px default-address control in the edit form', () => {
    assert.match(pageSource, /editingId \? 'Edit address'/);
    assert.match(pageSource, /Set as default address/);
    assert.match(pageSource, /Default address/);
    assert.match(pageSource, /editingId === defaultAddressId/);
    assert.match(pageSource, /min-h-\[48px\]/);
  });

  it('does not write isDefault on the address document from the edit form', () => {
    assert.match(
      pageSource,
      /const input = \{\s*\.\.\.form,\s*mobile10: digitsOnly\(form\.mobile10\),\s*location,\s*\}/,
    );
    assert.equal(pageSource.includes('isDefault:'), false);
    const payload = buildCustomerAddressPayload(validInput, 'addr_1', {
      createdAt: 'C',
      updatedAt: 'U',
    });
    assert.equal(Object.hasOwn(payload, 'isDefault'), false);
  });

  it('leaves the existing default unchanged unless the edited address is selected', () => {
    assert.match(pageSource, /setAsDefault && editingId !== defaultAddressId/);
    assert.match(pageSource, /setDefaultCustomerAddress\(firebaseUser, editingId\)/);
  });

  it('uses the existing default-pointer helper when a non-default address is selected', async () => {
    const deps = createMemoryDeps();
    seedProfile(deps);
    const first = await createCustomerAddress(VALID_USER, validInput, deps);
    const second = await createCustomerAddress(
      VALID_USER,
      { ...validInput, label: 'Office', fullName: 'Office Desk' },
      deps,
    );
    assert.equal(
      deps.store.get(`customers/${VALID_UID}`).defaultAddressId,
      first.address.addressId,
    );

    const switched = await setDefaultCustomerAddress(VALID_USER, second.address.addressId, deps);
    assert.equal(switched.status, 'ok');
    assert.equal(
      deps.store.get(`customers/${VALID_UID}`).defaultAddressId,
      second.address.addressId,
    );
    assert.equal(
      Object.hasOwn(deps.store.get(`customers/${VALID_UID}/addresses/${second.address.addressId}`), 'isDefault'),
      false,
    );
  });
});
