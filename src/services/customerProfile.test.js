import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CUSTOMER_PROFILE_FIELDS,
  CUSTOMER_PROFILE_SCHEMA_VERSION,
  FROZEN_CUSTOMER_PROFILE_FIELDS,
  PROFILE_SAVE_UNAVAILABLE_MESSAGE,
  buildCustomerProfileCreatePayload,
  buildCustomerProfileUpdatePayload,
  ensureCustomerProfile,
  formatMaskedCustomerMobile,
  getCustomerIdentityFromUser,
  getCustomerProfile,
  isValidCustomerUid,
  parseCustomerIdentityFromUid,
  updateCustomerProfile,
  wouldOverwriteFrozenFields,
} from './customerProfile.js';

const VALID_MOBILE10 = '9876543210';
const VALID_UID = `phone_91${VALID_MOBILE10}`;
const VALID_USER = { uid: VALID_UID };

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'customerProfile.js');
const source = readFileSync(sourcePath, 'utf8');

const createMemoryDeps = (seed = new Map()) => {
  const store = new Map(seed);
  const writes = [];

  return {
    writes,
    store,
    db: { name: 'memory' },
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    doc: (_db, collectionName, id) => ({ collectionName, id }),
    getDoc: async (ref) => {
      const existing = store.get(ref.id);
      return {
        exists: () => existing != null,
        data: () => existing ?? null,
      };
    },
    setDoc: async (ref, data, options) => {
      writes.push({ id: ref.id, data, options });
      if (options?.merge) {
        throw new Error('create-only must not use merge');
      }
      if (store.has(ref.id)) {
        const error = new Error('already-exists');
        error.code = 'already-exists';
        throw error;
      }
      store.set(ref.id, data);
    },
    deleteField: () => ({ __deleteField: true }),
    updateDoc: async (ref, data) => {
      writes.push({ id: ref.id, data, type: 'update' });
      const existing = store.get(ref.id);
      if (!existing) {
        const error = new Error('not-found');
        error.code = 'not-found';
        throw error;
      }
      const next = { ...existing };
      for (const [key, value] of Object.entries(data || {})) {
        if (value && value.__deleteField) {
          delete next[key];
        } else {
          next[key] = value;
        }
      }
      store.set(ref.id, next);
    },
  };
};

describe('customer UID identity', () => {
  it('maps a valid customer UID to mobile10', () => {
    assert.equal(isValidCustomerUid(VALID_UID), true);
    assert.deepEqual(parseCustomerIdentityFromUid(VALID_UID), {
      uid: VALID_UID,
      mobile10: VALID_MOBILE10,
    });
    assert.deepEqual(getCustomerIdentityFromUser(VALID_USER), {
      uid: VALID_UID,
      mobile10: VALID_MOBILE10,
    });
  });

  it('rejects invalid UIDs', () => {
    const invalid = [
      '',
      'phone_91',
      'phone_911234567890',
      'phone_915876543210',
      'phone_91987654321',
      'phone_9198765432100',
      'phone_+919876543210',
      '919876543210',
      '9876543210',
      'user-abc',
    ];
    for (const uid of invalid) {
      assert.equal(isValidCustomerUid(uid), false, uid);
      assert.equal(parseCustomerIdentityFromUid(uid), null, uid);
      assert.equal(getCustomerIdentityFromUser({ uid }), null, uid);
    }
  });

  it('rejects a missing user safely', () => {
    assert.equal(getCustomerIdentityFromUser(null), null);
    assert.equal(getCustomerIdentityFromUser(undefined), null);
    assert.equal(parseCustomerIdentityFromUid(undefined), null);
  });
});

describe('masked mobile display', () => {
  it('formats +91 XXXXX XXXXX with first 2 and last 2 digits only', () => {
    assert.equal(formatMaskedCustomerMobile(VALID_MOBILE10), '+91 98XXX XXX10');
    assert.equal(formatMaskedCustomerMobile(VALID_MOBILE10).includes(VALID_MOBILE10), false);
    assert.equal(formatMaskedCustomerMobile('invalid'), '');
  });
});

describe('create payload', () => {
  it('builds only the approved 1A.7 fields', () => {
    const payload = buildCustomerProfileCreatePayload(
      { uid: VALID_UID, mobile10: VALID_MOBILE10 },
      () => 'SERVER_TIMESTAMP',
    );
    assert.deepEqual(Object.keys(payload), CUSTOMER_PROFILE_FIELDS);
    assert.equal(payload.uid, VALID_UID);
    assert.equal(payload.mobile10, VALID_MOBILE10);
    assert.equal(payload.schemaVersion, CUSTOMER_PROFILE_SCHEMA_VERSION);
    assert.equal(payload.createdAt, 'SERVER_TIMESTAMP');
    assert.equal(payload.updatedAt, 'SERVER_TIMESTAMP');
    assert.equal(Object.hasOwn(payload, 'displayName'), false);
    assert.equal(Object.hasOwn(payload, 'email'), false);
  });
});

describe('ensureCustomerProfile', () => {
  it('skips missing users without writing', async () => {
    const deps = createMemoryDeps();
    const result = await ensureCustomerProfile(null, deps);
    assert.deepEqual(result, { status: 'skipped', reason: 'missing-user' });
    assert.equal(deps.writes.length, 0);
  });

  it('does not create a profile for an Admin user', async () => {
    const deps = createMemoryDeps();
    const result = await ensureCustomerProfile(
      { uid: 'admin-firebase-uid', email: 'support@prnexusgroup.com' },
      deps,
    );
    assert.deepEqual(result, { status: 'skipped', reason: 'admin' });
    assert.equal(deps.writes.length, 0);
    assert.equal(deps.store.size, 0);
  });

  it('does not create a profile for an Admin even if the UID looks like a customer', async () => {
    const deps = createMemoryDeps();
    const result = await ensureCustomerProfile(
      { uid: VALID_UID, email: 'info@prnexusgroup.com' },
      deps,
    );
    assert.deepEqual(result, { status: 'skipped', reason: 'admin' });
    assert.equal(deps.writes.length, 0);
  });

  it('does not create a profile for an invalid customer UID', async () => {
    const deps = createMemoryDeps();
    const result = await ensureCustomerProfile({ uid: 'google-user-123' }, deps);
    assert.deepEqual(result, { status: 'skipped', reason: 'invalid-uid' });
    assert.equal(deps.writes.length, 0);
  });

  it('creates a missing profile', async () => {
    const deps = createMemoryDeps();
    const result = await ensureCustomerProfile(VALID_USER, deps);
    assert.equal(result.status, 'created');
    assert.equal(deps.writes.length, 1);
    assert.equal(deps.writes[0].options, undefined);
    assert.equal(result.profile.uid, VALID_UID);
    assert.equal(result.profile.mobile10, VALID_MOBILE10);
    assert.equal(result.profile.schemaVersion, 1);
    assert.deepEqual(deps.store.get(VALID_UID), result.profile);
  });

  it('does not overwrite an existing profile', async () => {
    const existing = {
      uid: VALID_UID,
      mobile10: VALID_MOBILE10,
      createdAt: 'CREATED',
      updatedAt: 'UPDATED',
      schemaVersion: 1,
    };
    const deps = createMemoryDeps(new Map([[VALID_UID, existing]]));
    const result = await ensureCustomerProfile(VALID_USER, deps);
    assert.equal(result.status, 'existing');
    assert.equal(result.profile, existing);
    assert.equal(deps.writes.length, 0);
    assert.deepEqual(deps.store.get(VALID_UID), existing);
  });

  it('treats a create race as success without changing frozen fields', async () => {
    const existing = {
      uid: VALID_UID,
      mobile10: VALID_MOBILE10,
      createdAt: 'CREATED',
      updatedAt: 'UPDATED',
      schemaVersion: 1,
    };
    const deps = createMemoryDeps();
    const originalGetDoc = deps.getDoc;
    let reads = 0;
    deps.getDoc = async (ref) => {
      reads += 1;
      if (reads === 1) {
        return { exists: () => false, data: () => null };
      }
      return originalGetDoc(ref);
    };
    deps.setDoc = async () => {
      deps.store.set(VALID_UID, existing);
      const error = new Error('already-exists');
      error.code = 'already-exists';
      throw error;
    };

    const result = await ensureCustomerProfile(VALID_USER, deps);
    assert.equal(result.status, 'existing');
    assert.deepEqual(result.profile, existing);
    assert.equal(wouldOverwriteFrozenFields(existing, result.profile), false);
  });

  it('is fail-soft when Firestore is unavailable', async () => {
    const result = await ensureCustomerProfile(VALID_USER, {
      db: {},
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      doc: () => ({ id: VALID_UID }),
      getDoc: async () => {
        throw new Error('unavailable');
      },
      setDoc: async () => {
        throw new Error('should not write after get failure');
      },
    });
    assert.deepEqual(result, { status: 'unavailable' });
    assert.equal(typeof PROFILE_SAVE_UNAVAILABLE_MESSAGE, 'string');
    assert.equal(PROFILE_SAVE_UNAVAILABLE_MESSAGE.includes('Firebase'), false);
  });
});

describe('frozen profile fields', () => {
  it('detects changes to uid, mobile10, createdAt, and schemaVersion', () => {
    const existing = {
      uid: VALID_UID,
      mobile10: VALID_MOBILE10,
      createdAt: 'CREATED',
      updatedAt: 'UPDATED',
      schemaVersion: 1,
    };
    assert.equal(wouldOverwriteFrozenFields(existing, { uid: 'phone_919999999999' }), true);
    assert.equal(wouldOverwriteFrozenFields(existing, { mobile10: '9999999999' }), true);
    assert.equal(wouldOverwriteFrozenFields(existing, { createdAt: 'OTHER' }), true);
    assert.equal(wouldOverwriteFrozenFields(existing, { schemaVersion: 2 }), true);
    assert.equal(wouldOverwriteFrozenFields(existing, { updatedAt: 'LATER' }), false);
    assert.deepEqual(FROZEN_CUSTOMER_PROFILE_FIELDS, [
      'uid',
      'mobile10',
      'createdAt',
      'schemaVersion',
    ]);
  });
});

describe('no token or web storage', () => {
  it('does not read or write localStorage, sessionStorage, or tokens', async () => {
    const deps = createMemoryDeps();
    await ensureCustomerProfile(VALID_USER, deps);
    parseCustomerIdentityFromUid(VALID_UID);
    formatMaskedCustomerMobile(VALID_MOBILE10);

    assert.equal(/\blocalStorage\.(get|set|remove)Item\b/.test(source), false);
    assert.equal(/\bsessionStorage\.(get|set|remove)Item\b/.test(source), false);
    assert.equal(source.includes('customToken'), false);
    assert.equal(source.includes('AuthKey'), false);
    assert.equal(source.includes('searchParams'), false);
    assert.equal(source.includes('window.location'), false);
  });
});

describe('getCustomerProfile', () => {
  it('reads an existing profile without writing', async () => {
    const existing = {
      uid: VALID_UID,
      mobile10: VALID_MOBILE10,
      createdAt: 'CREATED',
      updatedAt: 'UPDATED',
      schemaVersion: 1,
      displayName: 'Ajay',
    };
    const deps = createMemoryDeps(new Map([[VALID_UID, existing]]));
    const result = await getCustomerProfile(VALID_USER, deps);
    assert.equal(result.status, 'ok');
    assert.equal(result.profile.displayName, 'Ajay');
    assert.equal(result.profile.uid, VALID_UID);
    assert.equal(deps.writes.length, 0);
  });

  it('does not use a caller-supplied uid', async () => {
    const deps = createMemoryDeps(new Map([[VALID_UID, { uid: VALID_UID, mobile10: VALID_MOBILE10 }]]));
    const result = await getCustomerProfile(
      { uid: VALID_UID, requestedUid: 'phone_919999999999' },
      deps,
    );
    assert.equal(result.status, 'ok');
    assert.equal(result.profile.uid, VALID_UID);
  });
});

describe('updateCustomerProfile', () => {
  const seedProfile = {
    uid: VALID_UID,
    mobile10: VALID_MOBILE10,
    createdAt: 'CREATED',
    updatedAt: 'UPDATED',
    schemaVersion: 1,
  };

  it('updates displayName only', async () => {
    const deps = createMemoryDeps(new Map([[VALID_UID, { ...seedProfile }]]));
    const result = await updateCustomerProfile(VALID_USER, { displayName: '  Rajesh  ' }, deps);
    assert.equal(result.status, 'ok');
    assert.equal(result.profile.displayName, 'Rajesh');
    assert.equal(result.profile.uid, VALID_UID);
    assert.equal(result.profile.mobile10, VALID_MOBILE10);
    assert.equal(result.profile.createdAt, 'CREATED');
    assert.equal(result.profile.schemaVersion, 1);
    assert.equal(result.profile.updatedAt, 'SERVER_TIMESTAMP');
    assert.deepEqual(Object.keys(deps.writes[0].data).sort(), ['displayName', 'updatedAt']);
  });

  it('updates defaultAddressId only', async () => {
    const deps = createMemoryDeps(new Map([[VALID_UID, { ...seedProfile }]]));
    const result = await updateCustomerProfile(
      VALID_USER,
      { defaultAddressId: 'addr_home_1' },
      deps,
    );
    assert.equal(result.status, 'ok');
    assert.equal(result.profile.defaultAddressId, 'addr_home_1');
    assert.deepEqual(Object.keys(deps.writes[0].data).sort(), ['defaultAddressId', 'updatedAt']);
  });

  it('strips frozen identity fields from an update patch', async () => {
    const deps = createMemoryDeps(new Map([[VALID_UID, { ...seedProfile }]]));
    const result = await updateCustomerProfile(
      VALID_USER,
      {
        displayName: 'Safe',
        uid: 'phone_919999999999',
        mobile10: '9999999999',
        createdAt: 'HACKED',
        schemaVersion: 99,
        email: 'attacker@example.com',
      },
      deps,
    );
    assert.equal(result.status, 'ok');
    assert.equal(result.profile.uid, VALID_UID);
    assert.equal(result.profile.mobile10, VALID_MOBILE10);
    assert.equal(result.profile.createdAt, 'CREATED');
    assert.equal(result.profile.schemaVersion, 1);
    assert.equal(Object.hasOwn(result.profile, 'email'), false);
    assert.equal(Object.hasOwn(deps.writes[0].data, 'uid'), false);
    assert.equal(Object.hasOwn(deps.writes[0].data, 'mobile10'), false);
    assert.equal(Object.hasOwn(deps.writes[0].data, 'createdAt'), false);
    assert.equal(Object.hasOwn(deps.writes[0].data, 'schemaVersion'), false);
    assert.equal(Object.hasOwn(deps.writes[0].data, 'email'), false);
  });

  it('rejects unknown-only patches without writing', async () => {
    const deps = createMemoryDeps(new Map([[VALID_UID, { ...seedProfile }]]));
    const result = await updateCustomerProfile(VALID_USER, { email: 'x@y.z' }, deps);
    assert.equal(result.status, 'unavailable');
    assert.equal(deps.writes.length, 0);
  });

  it('skips unauthenticated updates', async () => {
    const deps = createMemoryDeps(new Map([[VALID_UID, { ...seedProfile }]]));
    const result = await updateCustomerProfile(null, { displayName: 'Nope' }, deps);
    assert.deepEqual(result, { status: 'skipped', reason: 'missing-user' });
    assert.equal(deps.writes.length, 0);
  });

  it('does not update another customer from caller input', async () => {
    const otherUid = 'phone_919999999999';
    const deps = createMemoryDeps(
      new Map([
        [VALID_UID, { ...seedProfile }],
        [otherUid, { ...seedProfile, uid: otherUid, mobile10: '9999999999' }],
      ]),
    );
    const result = await updateCustomerProfile(
      VALID_USER,
      { uid: otherUid, displayName: 'Intruder' },
      deps,
    );
    assert.equal(result.status, 'ok');
    assert.equal(deps.store.get(VALID_UID).displayName, 'Intruder');
    assert.equal(Object.hasOwn(deps.store.get(otherUid), 'displayName'), false);
  });

  it('builds an allowlisted update payload', () => {
    const payload = buildCustomerProfileUpdatePayload(
      { displayName: 'Ajay' },
      () => 'SERVER_TIMESTAMP',
      () => ({ __deleteField: true }),
    );
    assert.deepEqual(payload, { displayName: 'Ajay', updatedAt: 'SERVER_TIMESTAMP' });
  });
});
