/**
 * Phase 1A.9 customer My Orders.
 *
 * Identity comes only from the Firebase Auth user (auth.currentUser.uid).
 * Never uses URL params, browser storage, or delivery mobile.
 * Firestore rules remain the security boundary.
 */

import {
  formatMaskedCustomerMobile,
  getCustomerIdentityFromUser,
  isValidCustomerMobile10,
} from './customerProfile.js';
import { isAuthorizedAdminUser } from '../utils/adminAuth.js';

export const MY_ORDERS_COLLECTION = 'orders';
export const MY_ORDERS_LIMIT = 50;
export const MY_ORDERS_PATH = '/account/orders';
export const MY_ORDERS_UNAVAILABLE_MESSAGE = "We couldn't load your orders.";
export const MY_ORDERS_EMPTY_TITLE = 'No orders yet';
export const MY_ORDERS_EMPTY_MESSAGE = 'Your FishMart orders will appear here.';
export const MY_ORDERS_START_SHOPPING_TO = '/';

export const CUSTOMER_ORDER_STATUS_LABELS = {
  Processing: 'Processing',
  Preparing: 'Preparing',
  'Out for Delivery': 'Out for delivery',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const getCustomerOrderSortMillis = (order) =>
  toMillis(order?.timestamp) || toMillis(order?.createdAt);

export const sortCustomerOrdersNewestFirst = (orders) =>
  [...(Array.isArray(orders) ? orders : [])].sort(
    (a, b) => getCustomerOrderSortMillis(b) - getCustomerOrderSortMillis(a),
  );

export const getCustomerOrderStatusLabel = (orderStatus) => {
  if (typeof orderStatus === 'string' && CUSTOMER_ORDER_STATUS_LABELS[orderStatus]) {
    return CUSTOMER_ORDER_STATUS_LABELS[orderStatus];
  }
  return CUSTOMER_ORDER_STATUS_LABELS.Processing;
};

export const getCustomerPaymentLabel = (order) => {
  if (order?.paymentStatus === 'FAILED') return 'Payment failed';
  if (order?.paymentStatus === 'VERIFIED') return 'Payment confirmed';
  return 'Pending verification';
};

export const formatCustomerOrderDate = (order) => {
  const millis = getCustomerOrderSortMillis(order);
  if (!millis) return '';
  return new Date(millis).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatShortOrderId = (orderId) => {
  const id = typeof orderId === 'string' ? orderId : '';
  if (!id) return '';
  const compact = id.replace(/^ORDER_/, '');
  return compact.length > 8 ? compact.slice(-8) : compact;
};

export const summarizeOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  const names = items
    .map((item) => (typeof item?.name === 'string' ? item.name.trim() : ''))
    .filter(Boolean);
  if (names.length === 0) {
    return `${items.length} item${items.length === 1 ? '' : 's'}`;
  }
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
};

const maskDeliveryMobile = (mobileNumber) => {
  if (typeof mobileNumber !== 'string') return '';
  const digits = mobileNumber.replace(/\D/g, '');
  const mobile10 = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits.length === 10
      ? digits
      : '';
  if (!isValidCustomerMobile10(mobile10)) return '';
  return formatMaskedCustomerMobile(mobile10);
};

const toMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const toCustomerOrderView = (order) => {
  if (!order || typeof order !== 'object') return null;
  const delivery = order.deliveryInfo && typeof order.deliveryInfo === 'object'
    ? order.deliveryInfo
    : {};
  const orderStatus = order.orderStatus || 'Processing';

  return {
    orderId: order.orderId || '',
    shortOrderId: formatShortOrderId(order.orderId),
    dateLabel: formatCustomerOrderDate(order),
    sortMillis: getCustomerOrderSortMillis(order),
    orderStatus,
    orderStatusLabel: getCustomerOrderStatusLabel(orderStatus),
    paymentLabel: getCustomerPaymentLabel(order),
    itemSummary: summarizeOrderItems(order.items),
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: toMoney(order.subtotal),
    discount: toMoney(order.discount),
    deliveryCharge: toMoney(order.deliveryCharge),
    totalPrice: toMoney(order.totalPrice),
    offerName: typeof order.offerName === 'string' ? order.offerName : '',
    deliveryDate: order.deliveryDate || '',
    deliverySlot: order.deliverySlot || '',
    deliveryName: typeof delivery.customerName === 'string' ? delivery.customerName : '',
    deliveryAddress: typeof delivery.address === 'string' ? delivery.address : '',
    deliveryMobileMasked: maskDeliveryMobile(delivery.mobileNumber),
    paymentRef: typeof order.paymentRef === 'string' ? order.paymentRef : '',
    transactionId: typeof order.transactionId === 'string' ? order.transactionId : '',
  };
};

export const getMyOrdersScreenState = ({ authReady, redirectPath, loadStatus, orders }) => {
  if (!authReady) return 'auth-loading';
  if (redirectPath) return 'redirect';
  if (loadStatus === 'loading') return 'loading';
  if (loadStatus === 'unavailable') return 'error';
  if (!Array.isArray(orders) || orders.length === 0) return 'empty';
  return 'list';
};

const resolveOrdersDeps = async (deps = {}) => {
  if (
    deps.collection &&
    deps.query &&
    deps.where &&
    deps.limit &&
    deps.getDocs &&
    deps.db
  ) {
    return deps;
  }

  const [{ collection, query, where, limit, getDocs }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('../firebaseConfig.js'),
  ]);

  return {
    collection: deps.collection ?? collection,
    query: deps.query ?? query,
    where: deps.where ?? where,
    limit: deps.limit ?? limit,
    getDocs: deps.getDocs ?? getDocs,
    db: deps.db ?? db,
  };
};

/**
 * Load the signed-in customer's orders.
 * UID is taken only from the Auth user. Caller-supplied uid/mobile is ignored.
 */
export const getMyOrders = async (user, deps = {}) => {
  if (!user) {
    return { status: 'skipped', reason: 'missing-user', orders: [] };
  }
  if (isAuthorizedAdminUser(user)) {
    return { status: 'skipped', reason: 'admin', orders: [] };
  }

  const identity = getCustomerIdentityFromUser(user);
  if (!identity?.uid) {
    return { status: 'skipped', reason: 'invalid-uid', orders: [] };
  }

  try {
    const resolved = await resolveOrdersDeps(deps);
    const ordersRef = resolved.collection(resolved.db, MY_ORDERS_COLLECTION);
    const ordersQuery = resolved.query(
      ordersRef,
      resolved.where('customerUid', '==', identity.uid),
      resolved.limit(MY_ORDERS_LIMIT),
    );
    const snapshot = await resolved.getDocs(ordersQuery);
    const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];

    const owned = docs
      .map((docSnap) => {
        const data = typeof docSnap?.data === 'function' ? docSnap.data() : {};
        return {
          ...(data && typeof data === 'object' ? data : {}),
          orderId: data?.orderId || docSnap?.id || '',
        };
      })
      .filter((order) => order.customerUid === identity.uid)
      .map((order) => toCustomerOrderView(order))
      .filter(Boolean);

    return {
      status: 'ok',
      orders: sortCustomerOrdersNewestFirst(owned),
    };
  } catch {
    return { status: 'unavailable', orders: [] };
  }
};
