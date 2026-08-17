/**
 * Local Firestore rules verification (emulator only — does not deploy).
 * Run: npx firebase-tools emulators:exec --only firestore "node scripts/firestoreRulesVerification.mjs"
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectId = 'ajayseafoods-b6e6b';
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error?.message || String(error) });
    console.error(`FAIL  ${name}:`, error?.message || error);
  }
};

const main = async () => {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });

  await testEnv.clearFirestore();

  // Seed as admin
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'fishes', 'f1'), { id: 1, name: 'Pomfret', rate: 500, available: true });
    await setDoc(doc(db, 'offers', 'o1'), { name: 'Test Offer', enabled: true, usedCount: 0 });
    await setDoc(doc(db, 'shopSetting', 'main'), { upiId: 'test@okicici', name: 'PR Nexus' });
    await setDoc(doc(db, 'promotionAndDiscounts', 'banner'), { title: 'Banner' });
    await setDoc(doc(db, 'config', 'app'), { shopInfo: { upiId: 'test@okicici' } });
    await setDoc(doc(db, 'reviews', 'r1'), { id: 1, name: 'A', comment: 'Good', rating: 5 });
    await setDoc(doc(db, 'daily', 'd1'), { fishName: 'Pomfret', qty: 10 });
    await setDoc(doc(db, 'orders', 'ORDER_EXISTING'), {
      orderId: 'ORDER_EXISTING',
      paymentStatus: 'PENDING_CONFIRMATION',
      paidVerified: false,
      totalPrice: 100,
    });
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  const admin = testEnv
    .authenticatedContext('admin-support', { email: 'support@prnexusgroup.com' })
    .firestore();
  const unauthorized = testEnv
    .authenticatedContext('user-sales', { email: 'sales@prnexusgroup.com' })
    .firestore();
  const customerUid = 'phone_919876543210';
  const otherCustomerUid = 'phone_919999999999';
  const customer = testEnv.authenticatedContext(customerUid).firestore();
  const otherCustomer = testEnv.authenticatedContext(otherCustomerUid).firestore();

  // Public reads
  await check('3. public catalog read', () => assertSucceeds(getDoc(doc(anon, 'fishes', 'f1'))));
  await check('4. public offers read', () => assertSucceeds(getDoc(doc(anon, 'offers', 'o1'))));
  await check('5. public shop/UPI read', () => assertSucceeds(getDoc(doc(anon, 'shopSetting', 'main'))));
  await check('public config read', () => assertSucceeds(getDoc(doc(anon, 'config', 'app'))));
  await check('public reviews read', () => assertSucceeds(getDoc(doc(anon, 'reviews', 'r1'))));

  // Customer order create
  await check('6. customer order create', () =>
    assertSucceeds(
      setDoc(doc(anon, 'orders', 'ORDER_NEW_1'), {
        orderId: 'ORDER_NEW_1',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
        totalPrice: 250,
        items: [{ name: 'Pomfret', qty: 1 }],
      }),
    ),
  );

  await check('order create rejects bad paymentStatus', () =>
    assertFails(
      setDoc(doc(anon, 'orders', 'ORDER_BAD_PAY'), {
        orderId: 'ORDER_BAD_PAY',
        paymentStatus: 'VERIFIED',
        paidVerified: false,
      }),
    ),
  );

  await check('order create rejects paidVerified true', () =>
    assertFails(
      setDoc(doc(anon, 'orders', 'ORDER_BAD_PAID'), {
        orderId: 'ORDER_BAD_PAID',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: true,
      }),
    ),
  );

  await check('order create rejects orderId mismatch', () =>
    assertFails(
      setDoc(doc(anon, 'orders', 'ORDER_MISMATCH'), {
        orderId: 'OTHER_ID',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
      }),
    ),
  );

  await check('guest order create with customerUid denied', () =>
    assertFails(
      setDoc(doc(anon, 'orders', 'ORDER_GUEST_UID'), {
        orderId: 'ORDER_GUEST_UID',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
        customerUid,
      }),
    ),
  );

  await check('customer order create with own customerUid allowed', () =>
    assertSucceeds(
      setDoc(doc(customer, 'orders', 'ORDER_CUST_OWN'), {
        orderId: 'ORDER_CUST_OWN',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
        customerUid,
      }),
    ),
  );

  await check('customer order create with another customerUid denied', () =>
    assertFails(
      setDoc(doc(customer, 'orders', 'ORDER_CUST_OTHER'), {
        orderId: 'ORDER_CUST_OTHER',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
        customerUid: otherCustomerUid,
      }),
    ),
  );

  await check('customer order create without customerUid denied', () =>
    assertFails(
      setDoc(doc(customer, 'orders', 'ORDER_CUST_NONE'), {
        orderId: 'ORDER_CUST_NONE',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
      }),
    ),
  );

  await check('admin order create without customerUid allowed', () =>
    assertSucceeds(
      setDoc(doc(admin, 'orders', 'ORDER_ADMIN_GUEST'), {
        orderId: 'ORDER_ADMIN_GUEST',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
      }),
    ),
  );

  await check('admin order create with customerUid denied', () =>
    assertFails(
      setDoc(doc(admin, 'orders', 'ORDER_ADMIN_UID'), {
        orderId: 'ORDER_ADMIN_UID',
        paymentStatus: 'PENDING_CONFIRMATION',
        paidVerified: false,
        customerUid,
      }),
    ),
  );

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'orders', 'ORDER_OTHER_OWNED'), {
      orderId: 'ORDER_OTHER_OWNED',
      paymentStatus: 'PENDING_CONFIRMATION',
      paidVerified: false,
      customerUid: otherCustomerUid,
    });
  });

  await check('customer can read own order', () =>
    assertSucceeds(getDoc(doc(customer, 'orders', 'ORDER_CUST_OWN'))),
  );
  await check('customer cannot read another customer order', () =>
    assertFails(getDoc(doc(customer, 'orders', 'ORDER_OTHER_OWNED'))),
  );
  await check('customer cannot read guest order', () =>
    assertFails(getDoc(doc(customer, 'orders', 'ORDER_NEW_1'))),
  );
  await check('customer cannot read historical order without customerUid', () =>
    assertFails(getDoc(doc(customer, 'orders', 'ORDER_EXISTING'))),
  );
  await check('guest cannot read customer order', () =>
    assertFails(getDoc(doc(anon, 'orders', 'ORDER_CUST_OWN'))),
  );
  await check('other customer cannot read first customer order', () =>
    assertFails(getDoc(doc(otherCustomer, 'orders', 'ORDER_CUST_OWN'))),
  );
  await check('customer can query own orders', () =>
    assertSucceeds(
      getDocs(
        query(
          collection(customer, 'orders'),
          where('customerUid', '==', customerUid),
          limit(50),
        ),
      ),
    ),
  );
  await check('customer cannot list all orders', () =>
    assertFails(getDocs(collection(customer, 'orders'))),
  );
  await check('customer cannot query another customerUid', () =>
    assertFails(
      getDocs(
        query(
          collection(customer, 'orders'),
          where('customerUid', '==', otherCustomerUid),
          limit(50),
        ),
      ),
    ),
  );
  await check('customer cannot update own order', () =>
    assertFails(
      updateDoc(doc(customer, 'orders', 'ORDER_CUST_OWN'), {
        paymentStatus: 'VERIFIED',
        paidVerified: true,
      }),
    ),
  );
  await check('customer cannot delete own order', () =>
    assertFails(deleteDoc(doc(customer, 'orders', 'ORDER_CUST_OWN'))),
  );

  // Customer cannot read/update/delete guest or historical orders
  await check('7. customer cannot read orders', () =>
    assertFails(getDoc(doc(anon, 'orders', 'ORDER_EXISTING'))),
  );
  await check('7b. customer cannot list orders', () =>
    assertFails(getDocs(collection(anon, 'orders'))),
  );
  await check('8. customer cannot update orders', () =>
    assertFails(
      updateDoc(doc(anon, 'orders', 'ORDER_EXISTING'), { paymentStatus: 'VERIFIED', paidVerified: true }),
    ),
  );
  await check('customer cannot delete orders', () =>
    assertFails(deleteDoc(doc(anon, 'orders', 'ORDER_EXISTING'))),
  );

  // Customer cannot change admin data
  await check('9. customer cannot change fish rates', () =>
    assertFails(updateDoc(doc(anon, 'fishes', 'f1'), { rate: 1 })),
  );
  await check('10. customer cannot change stock (daily)', () =>
    assertFails(updateDoc(doc(anon, 'daily', 'd1'), { qty: 999 })),
  );
  await check('10b. customer cannot read daily stock', () =>
    assertFails(getDoc(doc(anon, 'daily', 'd1'))),
  );
  await check('11. customer cannot change offers', () =>
    assertFails(updateDoc(doc(anon, 'offers', 'o1'), { usedCount: 99, enabled: false })),
  );
  await check('12. customer cannot change UPI/shop settings', () =>
    assertFails(updateDoc(doc(anon, 'shopSetting', 'main'), { upiId: 'attacker@okicici' })),
  );

  // Reviews: create ok, update/delete denied
  await check('13. customer can create a review', () =>
    assertSucceeds(
      addDoc(collection(anon, 'reviews'), {
        id: Date.now(),
        name: 'Guest',
        comment: 'Fresh fish',
        rating: 5,
        verified: false,
      }),
    ),
  );
  await check('13b. customer cannot update reviews', () =>
    assertFails(updateDoc(doc(anon, 'reviews', 'r1'), { comment: 'hacked' })),
  );
  await check('13c. customer cannot delete reviews', () =>
    assertFails(deleteDoc(doc(anon, 'reviews', 'r1'))),
  );

  // Admin can manage
  await check('14. admin can read orders', () =>
    assertSucceeds(getDoc(doc(admin, 'orders', 'ORDER_EXISTING'))),
  );
  await check('admin can read customer-owned order', () =>
    assertSucceeds(getDoc(doc(admin, 'orders', 'ORDER_CUST_OWN'))),
  );
  await check('14b. admin can update fish rates', () =>
    assertSucceeds(updateDoc(doc(admin, 'fishes', 'f1'), { rate: 550 })),
  );
  await check('14c. admin can update order payment', () =>
    assertSucceeds(
      updateDoc(doc(admin, 'orders', 'ORDER_EXISTING'), {
        paymentStatus: 'VERIFIED',
        paidVerified: true,
      }),
    ),
  );
  await check('14d. admin can write shopSetting', () =>
    assertSucceeds(updateDoc(doc(admin, 'shopSetting', 'main'), { phone: '9096205136' })),
  );

  // Unauthorized authenticated user
  await check('15. unauthorized auth user cannot write fishes', () =>
    assertFails(updateDoc(doc(unauthorized, 'fishes', 'f1'), { rate: 2 })),
  );
  await check('15b. unauthorized auth user cannot read orders', () =>
    assertFails(getDoc(doc(unauthorized, 'orders', 'ORDER_EXISTING'))),
  );
  await check('15c. unauthorized cannot write AdminLogs', () =>
    assertFails(addDoc(collection(unauthorized, 'AdminLogs'), { op: 'x' })),
  );

  await check('_test_connection denied to public', () =>
    assertFails(getDocs(collection(anon, '_test_connection'))),
  );

  const profileCreatePayload = {
    uid: customerUid,
    mobile10: '9876543210',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: 1,
  };

  await check('customer can create own profile', () =>
    assertSucceeds(setDoc(doc(customer, 'customers', customerUid), profileCreatePayload)),
  );

  await check('customer profile create rejects extra fields', () =>
    assertFails(
      setDoc(doc(customer, 'customers', otherCustomerUid), {
        uid: otherCustomerUid,
        mobile10: '9999999999',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        schemaVersion: 1,
        displayName: 'Too Early',
      }),
    ),
  );

  await check('customer can read own profile', () =>
    assertSucceeds(getDoc(doc(customer, 'customers', customerUid))),
  );

  await check('customer can update displayName', () =>
    assertSucceeds(
      updateDoc(doc(customer, 'customers', customerUid), {
        displayName: 'Ajay',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('customer can update defaultAddressId', () =>
    assertSucceeds(
      updateDoc(doc(customer, 'customers', customerUid), {
        defaultAddressId: 'addr_home_1',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('customer cannot change uid', () =>
    assertFails(
      updateDoc(doc(customer, 'customers', customerUid), {
        uid: otherCustomerUid,
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('customer cannot change mobile10', () =>
    assertFails(
      updateDoc(doc(customer, 'customers', customerUid), {
        mobile10: '9999999999',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('customer cannot change createdAt', () =>
    assertFails(
      updateDoc(doc(customer, 'customers', customerUid), {
        createdAt: Timestamp.now(),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('customer cannot change schemaVersion', () =>
    assertFails(
      updateDoc(doc(customer, 'customers', customerUid), {
        schemaVersion: 2,
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('unknown profile fields rejected', () =>
    assertFails(
      updateDoc(doc(customer, 'customers', customerUid), {
        email: 'attacker@example.com',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('unauthenticated profile update rejected', () =>
    assertFails(
      updateDoc(doc(anon, 'customers', customerUid), {
        displayName: 'Guest',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('other customer cannot update profile', () =>
    assertFails(
      updateDoc(doc(otherCustomer, 'customers', customerUid), {
        displayName: 'Intruder',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  const addressPath = (db, addressId) =>
    doc(db, 'customers', customerUid, 'addresses', addressId);

  const validAddress = (addressId) => ({
    addressId,
    label: 'Home',
    fullName: 'Ajay Kumar',
    mobile10: '9123456789',
    address: '12 FC Road, Pune',
    location: { lat: 18.52, lng: 73.85, confirmed: true },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await check('customer creates own address', () =>
    assertSucceeds(setDoc(addressPath(customer, 'addr_ok'), validAddress('addr_ok'))),
  );

  await check('customer reads own addresses', () =>
    assertSucceeds(getDocs(collection(customer, 'customers', customerUid, 'addresses'))),
  );

  await check('customer updates own address', () =>
    assertSucceeds(
      updateDoc(addressPath(customer, 'addr_ok'), {
        fullName: 'Office Reception',
        label: 'Office',
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await check('customer creates a second address', () =>
    assertSucceeds(
      setDoc(addressPath(customer, 'addr_two'), {
        ...validAddress('addr_two'),
        label: 'Other',
        fullName: 'Family Home',
      }),
    ),
  );

  await check('customer cannot access another customer addresses', () =>
    assertFails(getDocs(collection(customer, 'customers', otherCustomerUid, 'addresses'))),
  );

  await check('invalid address mobile rejected', () =>
    assertFails(
      setDoc(addressPath(customer, 'addr_bad_mobile'), {
        ...validAddress('addr_bad_mobile'),
        mobile10: '1234567890',
      }),
    ),
  );

  await check('missing address name rejected', () =>
    assertFails(
      setDoc(addressPath(customer, 'addr_bad_name'), {
        ...validAddress('addr_bad_name'),
        fullName: '',
      }),
    ),
  );

  await check('missing address text rejected', () =>
    assertFails(
      setDoc(addressPath(customer, 'addr_bad_text'), {
        ...validAddress('addr_bad_text'),
        address: '',
      }),
    ),
  );

  await check('unconfirmed location rejected', () =>
    assertFails(
      setDoc(addressPath(customer, 'addr_unconfirmed'), {
        ...validAddress('addr_unconfirmed'),
        location: { lat: 18.52, lng: 73.85, confirmed: false },
      }),
    ),
  );

  await check('invalid address label rejected', () =>
    assertFails(
      setDoc(addressPath(customer, 'addr_bad_label'), {
        ...validAddress('addr_bad_label'),
        label: 'Warehouse',
      }),
    ),
  );

  await check('addressId must match document path', () =>
    assertFails(
      setDoc(addressPath(customer, 'addr_mismatch'), {
        ...validAddress('other-id'),
      }),
    ),
  );

  await check('unauthenticated address access rejected', () =>
    assertFails(getDocs(collection(anon, 'customers', customerUid, 'addresses'))),
  );

  await check('customer deletes own address', () =>
    assertSucceeds(deleteDoc(addressPath(customer, 'addr_two'))),
  );

  await check('admin can read customer profile', () =>
    assertSucceeds(getDoc(doc(admin, 'customers', customerUid))),
  );

  await check('admin can read customer address', () =>
    assertSucceeds(getDoc(addressPath(admin, 'addr_ok'))),
  );

  await testEnv.cleanup();

  const failed = results.filter((r) => !r.ok);
  console.log('\n========== SUMMARY ==========');
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(` - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  console.log('All Firestore rules checks passed.');
};

main().catch((error) => {
  console.error('Rules verification crashed:', error);
  process.exit(1);
});
