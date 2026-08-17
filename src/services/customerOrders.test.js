import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getAccountRedirectPath } from './customerSession.js';
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  MY_ORDERS_COLLECTION,
  MY_ORDERS_EMPTY_MESSAGE,
  MY_ORDERS_EMPTY_TITLE,
  MY_ORDERS_LIMIT,
  MY_ORDERS_PATH,
  MY_ORDERS_START_SHOPPING_TO,
  MY_ORDERS_UNAVAILABLE_MESSAGE,
  formatShortOrderId,
  getCustomerPaymentLabel,
  getCustomerOrderStatusLabel,
  getMyOrders,
  getMyOrdersScreenState,
  sortCustomerOrdersNewestFirst,
  summarizeOrderItems,
  toCustomerOrderView,
} from './customerOrders.js';

const VALID_MOBILE10 = '9876543210';
const VALID_UID = `phone_91${VALID_MOBILE10}`;
const OTHER_UID = 'phone_919999999999';
const VALID_USER = { uid: VALID_UID };
const DELIVERY_MOBILE = '9123456789';

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'customerOrders.js');
const source = readFileSync(sourcePath, 'utf8');
const pagePath = join(dirname(fileURLToPath(import.meta.url)), '../pages/CustomerOrders.jsx');
const pageSource = readFileSync(pagePath, 'utf8');
const accountPath = join(dirname(fileURLToPath(import.meta.url)), '../pages/Account.jsx');
const accountSource = readFileSync(accountPath, 'utf8');
const appPath = join(dirname(fileURLToPath(import.meta.url)), '../App.jsx');
const appSource = readFileSync(appPath, 'utf8');
const rulesPath = join(dirname(fileURLToPath(import.meta.url)), '../../firestore.rules');
const rulesSource = readFileSync(rulesPath, 'utf8');

const ownedOrder = {
  orderId: 'ORDER_100',
  customerUid: VALID_UID,
  items: [{ name: 'Pomfret', quantity: 1, rate: 500 }],
  totalPrice: 250,
  subtotal: 250,
  discount: 0,
  deliveryCharge: 0,
  paymentStatus: 'PENDING_CONFIRMATION',
  paidVerified: false,
  orderStatus: 'Processing',
  timestamp: '2026-08-17T12:00:00.000Z',
  createdAt: '2026-08-17T12:00:00.000Z',
  paymentRef: 'PAY123',
  transactionId: 'UTR123',
  deliveryDate: '2026-08-18',
  deliverySlot: 'MORNING',
  deliveryInfo: {
    customerName: 'Asha',
    mobileNumber: DELIVERY_MOBILE,
    address: 'Test address',
  },
};

const createQueryDeps = ({ docs = [], throwError = false } = {}) => {
  const calls = {
    collection: [],
    where: [],
    limit: [],
    query: [],
    getDocs: 0,
  };

  return {
    calls,
    db: { name: 'memory' },
    collection: (_db, name) => {
      calls.collection.push(name);
      return { name };
    },
    where: (field, op, value) => {
      calls.where.push({ field, op, value });
      return { type: 'where', field, op, value };
    },
    limit: (n) => {
      calls.limit.push(n);
      return { type: 'limit', n };
    },
    query: (ref, ...constraints) => {
      const built = { ref, constraints };
      calls.query.push(built);
      return built;
    },
    getDocs: async (q) => {
      calls.getDocs += 1;
      calls.lastQuery = q;
      if (throwError) {
        throw new Error('unavailable');
      }
      return {
        docs: docs.map((data) => ({
          id: data.orderId,
          data: () => data,
        })),
      };
    },
  };
};

describe('My Orders authentication gate', () => {
  it('sends guests to login', () => {
    assert.equal(getAccountRedirectPath(null), '/login');
    assert.equal(getAccountRedirectPath(undefined), '/login');
  });

  it('sends Admins to admin without signing them out', () => {
    assert.equal(
      getAccountRedirectPath({ email: 'support@prnexusgroup.com' }),
      '/admin',
    );
    assert.equal(
      getAccountRedirectPath({ email: 'info@prnexusgroup.com' }),
      '/admin',
    );
  });

  it('lets customers stay on account routes including My Orders', () => {
    assert.equal(getAccountRedirectPath(VALID_USER), null);
    assert.equal(MY_ORDERS_PATH, '/account/orders');
  });
});

describe('getMyOrders query', () => {
  it('queries orders where customerUid equals auth user uid', async () => {
    const deps = createQueryDeps({ docs: [ownedOrder] });
    const result = await getMyOrders(VALID_USER, deps);

    assert.equal(result.status, 'ok');
    assert.equal(deps.calls.collection[0], MY_ORDERS_COLLECTION);
    assert.deepEqual(deps.calls.where[0], {
      field: 'customerUid',
      op: '==',
      value: VALID_UID,
    });
    assert.equal(deps.calls.limit[0], MY_ORDERS_LIMIT);
    assert.equal(MY_ORDERS_LIMIT, 50);
    assert.equal(deps.calls.getDocs, 1);
    assert.equal(deps.calls.query.length, 1);
    assert.equal(result.orders.length, 1);
    assert.equal(result.orders[0].orderId, 'ORDER_100');
  });

  it('does not accept another UID from deps or order payload', async () => {
    const deps = createQueryDeps({ docs: [ownedOrder] });
    deps.uid = OTHER_UID;
    deps.customerUid = OTHER_UID;
    deps.mobile = DELIVERY_MOBILE;

    const result = await getMyOrders(
      { uid: VALID_UID, customerUid: OTHER_UID },
      deps,
    );

    assert.equal(deps.calls.where[0].value, VALID_UID);
    assert.notEqual(deps.calls.where[0].value, OTHER_UID);
    assert.equal(result.orders[0].orderId, 'ORDER_100');
  });

  it('does not query by mobile number', async () => {
    const deps = createQueryDeps({ docs: [ownedOrder] });
    await getMyOrders(VALID_USER, deps);
    assert.equal(deps.calls.where.some((clause) => clause.field === 'mobileNumber'), false);
    assert.equal(deps.calls.where.some((clause) => clause.value === DELIVERY_MOBILE), false);
    assert.equal(deps.calls.where.some((clause) => clause.value === VALID_MOBILE10), false);
  });

  it('returns empty state data when the customer has no owned orders', async () => {
    const deps = createQueryDeps({ docs: [] });
    const result = await getMyOrders(VALID_USER, deps);
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.orders, []);
    assert.equal(
      getMyOrdersScreenState({
        authReady: true,
        redirectPath: null,
        loadStatus: result.status,
        orders: result.orders,
      }),
      'empty',
    );
    assert.equal(MY_ORDERS_EMPTY_TITLE, 'No orders yet');
    assert.equal(MY_ORDERS_EMPTY_MESSAGE, 'Your FishMart orders will appear here.');
    assert.equal(MY_ORDERS_START_SHOPPING_TO, '/');
  });

  it('returns an error state when the query fails', async () => {
    const deps = createQueryDeps({ throwError: true });
    const result = await getMyOrders(VALID_USER, deps);
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.orders, []);
    assert.equal(
      getMyOrdersScreenState({
        authReady: true,
        redirectPath: null,
        loadStatus: result.status,
        orders: result.orders,
      }),
      'error',
    );
    assert.equal(MY_ORDERS_UNAVAILABLE_MESSAGE, "We couldn't load your orders.");
  });

  it('does not return historical or guest orders without customerUid', async () => {
    const deps = createQueryDeps({
      docs: [
        ownedOrder,
        { orderId: 'ORDER_GUEST', items: [], totalPrice: 10, paymentStatus: 'PENDING_CONFIRMATION' },
        {
          orderId: 'ORDER_OTHER',
          customerUid: OTHER_UID,
          items: [{ name: 'Seer' }],
          totalPrice: 99,
          timestamp: '2026-08-16T12:00:00.000Z',
        },
      ],
    });
    const result = await getMyOrders(VALID_USER, deps);
    assert.deepEqual(result.orders.map((order) => order.orderId), ['ORDER_100']);
  });

  it('skips guests, Admins, and invalid users without querying', async () => {
    const guestDeps = createQueryDeps();
    const adminDeps = createQueryDeps();
    const invalidDeps = createQueryDeps();

    assert.deepEqual(await getMyOrders(null, guestDeps), {
      status: 'skipped',
      reason: 'missing-user',
      orders: [],
    });
    assert.deepEqual(
      await getMyOrders({ email: 'support@prnexusgroup.com' }, adminDeps),
      { status: 'skipped', reason: 'admin', orders: [] },
    );
    assert.deepEqual(await getMyOrders({ uid: 'google-user-123' }, invalidDeps), {
      status: 'skipped',
      reason: 'invalid-uid',
      orders: [],
    });
    assert.equal(guestDeps.calls.getDocs, 0);
    assert.equal(adminDeps.calls.getDocs, 0);
    assert.equal(invalidDeps.calls.getDocs, 0);
  });

  it('sorts newest first using timestamp then createdAt', () => {
    const sorted = sortCustomerOrdersNewestFirst([
      { orderId: 'old', createdAt: '2026-08-01T00:00:00.000Z' },
      { orderId: 'new', timestamp: '2026-08-17T00:00:00.000Z' },
    ]);
    assert.deepEqual(sorted.map((order) => order.orderId), ['new', 'old']);
  });
});

describe('customer order display projection', () => {
  it('shows own order fields without internal security data', () => {
    const view = toCustomerOrderView(ownedOrder);
    assert.equal(view.orderId, 'ORDER_100');
    assert.equal(view.totalPrice, 250);
    assert.equal(view.orderStatusLabel, 'Processing');
    assert.equal(view.paymentLabel, 'Pending verification');
    assert.equal(view.itemSummary, 'Pomfret');
    assert.equal(view.deliveryMobileMasked.includes(DELIVERY_MOBILE), false);
    assert.equal(Object.hasOwn(view, 'customerUid'), false);
    assert.equal(Object.hasOwn(view, 'paidVerified'), false);
  });

  it('maps actual statuses only', () => {
    assert.equal(getCustomerOrderStatusLabel('Out for Delivery'), 'Out for delivery');
    assert.equal(getCustomerPaymentLabel({ paymentStatus: 'VERIFIED' }), 'Payment confirmed');
    assert.equal(getCustomerPaymentLabel({ paymentStatus: 'FAILED' }), 'Payment failed');
    assert.deepEqual(Object.keys(CUSTOMER_ORDER_STATUS_LABELS), [
      'Processing',
      'Preparing',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
    ]);
    assert.equal(summarizeOrderItems([{ name: 'A' }, { name: 'B' }, { name: 'C' }]), 'A, B +1 more');
    assert.equal(formatShortOrderId('ORDER_1755442211000'), '42211000');
  });
});

describe('My Orders source safety', () => {
  it('uses getDocs with a customerUid equality query and no Admin loader', () => {
    assert.match(source, /where\('customerUid', '==', identity\.uid\)/);
    assert.match(source, /getDocs/);
    assert.match(source, /limit\(MY_ORDERS_LIMIT\)/);
    assert.equal(source.includes('onSnapshot'), false);
    assert.equal(source.includes('orderBy'), false);
    assert.equal(source.includes('getCustomerOrders'), false);
    assert.equal(source.includes('localStorage'), false);
    assert.equal(source.includes('sessionStorage'), false);
    assert.equal(source.includes('searchParams'), false);
    assert.equal(source.includes('useParams'), false);
  });

  it('keeps the Account My Orders route under /account/orders', () => {
    assert.match(appSource, /path="\/account\/orders"/);
    assert.match(appSource, /CustomerOrders/);
    assert.match(pageSource, /getAccountRedirectPath/);
    assert.match(pageSource, /getMyOrders/);
    assert.equal(pageSource.includes('getCustomerOrders'), false);
    assert.equal(pageSource.includes('useParams'), false);
    assert.equal(pageSource.includes('localStorage'), false);
    assert.equal(accountSource.includes("to=\"/account/orders\""), true);
    assert.equal(accountSource.includes("id: 'orders'"), false);
  });

  it('opens customer order reads without changing create/update/delete', () => {
    assert.match(
      rulesSource,
      /resource\.data\.customerUid == request\.auth\.uid/,
    );
    assert.match(rulesSource, /allow update, delete: if isAdmin\(\);/);
    assert.match(rulesSource, /allow create: if/);
    assert.equal(rulesSource.includes('allow read, update, delete: if isAdmin();'), false);
  });
});
