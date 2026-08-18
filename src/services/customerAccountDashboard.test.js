import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACTIVE_ORDER_STATUSES,
  filterCustomerOrdersByStatus,
  formatAccountVerifiedMobile,
  formatCompactOrderDate,
  formatOrderNumber,
  getAccountWelcomeTitle,
  getActiveCustomerOrders,
  getOrderItemsColumnLabel,
  getRecentCustomerOrders,
} from './customerAccountDashboard.js';
import { isAccountExperiencePath } from './accountExperiencePath.js';

const here = dirname(fileURLToPath(import.meta.url));
const accountSource = readFileSync(join(here, '../pages/Account.jsx'), 'utf8');
const appSource = readFileSync(join(here, '../App.jsx'), 'utf8');
const layoutSource = readFileSync(join(here, '../components/AccountLayout.jsx'), 'utf8');
const helperSource = readFileSync(join(here, 'customerAccountDashboard.js'), 'utf8');

describe('account greeting and mobile mask', () => {
  it('uses displayName when present and never invents a name', () => {
    assert.equal(getAccountWelcomeTitle('Pavan Murkute'), 'Welcome back, Pavan Murkute! 👋');
    assert.equal(getAccountWelcomeTitle('  Ajay  '), 'Welcome back, Ajay! 👋');
    assert.equal(getAccountWelcomeTitle(''), 'Welcome back! 👋');
    assert.equal(getAccountWelcomeTitle(null), 'Welcome back! 👋');
    assert.equal(getAccountWelcomeTitle(undefined), 'Welcome back! 👋');
  });

  it('masks verified mobile with first 2 and last 2 digits', () => {
    assert.equal(formatAccountVerifiedMobile('7678901267'), '+91 76****67');
    assert.equal(formatAccountVerifiedMobile(''), '');
    assert.equal(formatAccountVerifiedMobile('123'), '');
  });
});

describe('order dashboard views', () => {
  const orders = [
    { orderId: 'A', orderStatus: 'Processing', items: [{ id: '1' }], sortMillis: 3 },
    { orderId: 'B', orderStatus: 'Delivered', items: [{ id: '2' }, { id: '3' }], sortMillis: 2 },
    { orderId: 'C', orderStatus: 'Cancelled', items: [], sortMillis: 1 },
    { orderId: 'D', orderStatus: 'Out for Delivery', items: [{ id: '4' }], sortMillis: 4 },
    { orderId: 'E', orderStatus: 'Preparing', items: [{ id: '5' }], sortMillis: 5 },
  ];

  it('counts only non-final statuses as active', () => {
    assert.deepEqual(ACTIVE_ORDER_STATUSES, ['Processing', 'Preparing', 'Out for Delivery']);
    const active = getActiveCustomerOrders(orders).map((order) => order.orderId);
    assert.deepEqual(active, ['A', 'D', 'E']);
  });

  it('returns the newest slice for recent orders', () => {
    assert.equal(getRecentCustomerOrders(orders).length, 3);
    assert.equal(getRecentCustomerOrders(orders, 2).length, 2);
    assert.equal(getRecentCustomerOrders(orders, 2)[0].orderId, 'A');
  });

  it('filters by exact existing status labels', () => {
    assert.equal(filterCustomerOrdersByStatus(orders, 'All').length, 5);
    assert.equal(filterCustomerOrdersByStatus(orders, 'Delivered').length, 1);
    assert.equal(filterCustomerOrdersByStatus(orders, 'Processing')[0].orderId, 'A');
  });

  it('formats compact date, item count, and order number', () => {
    assert.equal(getOrderItemsColumnLabel({ items: [{}, {}] }), '2 items');
    assert.equal(getOrderItemsColumnLabel({ items: [{}] }), '1 item');
    assert.equal(formatOrderNumber({ shortOrderId: '42211000' }), '#42211000');
    const label = formatCompactOrderDate({ sortMillis: new Date(2026, 7, 18, 12).getTime() });
    assert.match(label, /18/);
    assert.match(label, /Aug/i);
  });
});

describe('account dashboard source safety', () => {
  it('keeps Account order and address links for existing tests', () => {
    assert.equal(accountSource.includes('to="/account/orders"'), true);
    assert.equal(accountSource.includes('to="/account/addresses"'), true);
    assert.equal(accountSource.includes("id: 'orders'"), false);
  });

  it('does not load catalog or Order Again on Account overview', () => {
    assert.match(appSource, /path="\/account"/);
    assert.match(appSource, /<Route path="\/account" element=\{<Account \/>\} \/>/);
    assert.equal(accountSource.includes('fishData'), false);
    assert.equal(accountSource.includes('addToCart'), false);
    assert.equal(helperSource.includes('getOrderAgainItems'), false);
    assert.equal(accountSource.includes('getOrderAgainItems'), false);
    assert.equal(accountSource.includes('Order Again'), false);
    assert.equal(accountSource.includes('createCustomerOrder'), false);
    assert.equal(accountSource.includes('updateCustomerOrderStatus'), false);
    assert.equal(accountSource.includes('Default Address'), false);
    assert.equal(accountSource.includes('Default Delivery Address'), false);
    assert.equal(accountSource.includes('toCustomerAddressView'), false);
    assert.equal(accountSource.includes('loadFishDataFromFirestore'), false);
    assert.match(helperSource, /export const RECENT_ORDERS_LIMIT = 3;/);
    assert.match(accountSource, /getRecentCustomerOrders\(orders,\s*3\)/);
    assert.equal(accountSource.includes('OrderDetails'), false);
    assert.match(accountSource, /hidden lg:flex/);
    assert.match(accountSource, /hidden lg:block/);
    assert.match(accountSource, /lg:hidden/);
    assert.match(accountSource, /<th className="py-2 pr-3 font-semibold">Order<\/th>/);
    assert.match(accountSource, /<th className="py-2 pr-3 font-semibold">Date<\/th>/);
    assert.match(accountSource, /<th className="py-2 pr-3 font-semibold">Items<\/th>/);
    assert.match(accountSource, /<th className="py-2 pr-3 font-semibold">Amount<\/th>/);
    assert.match(accountSource, /<th className="py-2 pr-3 font-semibold">Status<\/th>/);
    assert.match(accountSource, /<th className="py-2 font-semibold">Action<\/th>/);
    assert.match(accountSource, /grid-cols-2 lg:grid-cols-4/);
  });

  it('defers catalog loading on account and login paths', () => {
    assert.match(appSource, /isAccountExperiencePath/);
    assert.match(appSource, /catalogLoadStartedRef/);
    assert.match(appSource, /if \(accountExperience\) return undefined;/);
  });

  it('shared nav lists required labels and does not truncate them', () => {
    assert.match(layoutSource, /Overview/);
    assert.match(layoutSource, /My Orders/);
    assert.match(layoutSource, /Addresses/);
    assert.match(layoutSource, /Favourites/);
    assert.match(layoutSource, /Rewards/);
    assert.match(layoutSource, /Help &amp; Support/);
    assert.match(layoutSource, /Logout/);
    assert.match(layoutSource, /Coming Soon/);
    assert.match(layoutSource, /Account menu/);
    assert.equal(layoutSource.includes('truncate'), false);
    assert.match(layoutSource, /hidden lg:block/);
  });

});

describe('account experience path', () => {
  it('treats login and account routes as catalog-free', () => {
    assert.equal(isAccountExperiencePath('/login'), true);
    assert.equal(isAccountExperiencePath('/account'), true);
    assert.equal(isAccountExperiencePath('/account/orders'), true);
    assert.equal(isAccountExperiencePath('/account/addresses'), true);
    assert.equal(isAccountExperiencePath('/'), false);
    assert.equal(isAccountExperiencePath('/contact'), false);
  });
});
