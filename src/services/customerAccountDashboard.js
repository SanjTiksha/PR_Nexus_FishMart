/**
 * Account dashboard view helpers.
 *
 * UI-only. Does not query Firestore, change ownership, or alter pricing.
 */

export const RECENT_ORDERS_LIMIT = 3;

export const ACTIVE_ORDER_STATUSES = ['Processing', 'Preparing', 'Out for Delivery'];

export const ORDER_STATUS_FILTERS = [
  'All',
  'Processing',
  'Preparing',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

export const getAccountWelcomeTitle = (displayName) => {
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  return name ? `Welcome back, ${name}! 👋` : 'Welcome back! 👋';
};

export const formatAccountVerifiedMobile = (mobile10) => {
  if (typeof mobile10 !== 'string' || !/^[6-9]\d{9}$/.test(mobile10)) return '';
  return `+91 ${mobile10.slice(0, 2)}****${mobile10.slice(-2)}`;
};

export const isActiveCustomerOrder = (order) =>
  Boolean(order) && ACTIVE_ORDER_STATUSES.includes(order.orderStatus);

export const getActiveCustomerOrders = (orders) =>
  (Array.isArray(orders) ? orders : []).filter(isActiveCustomerOrder);

export const getRecentCustomerOrders = (orders, limit = RECENT_ORDERS_LIMIT) => {
  const list = Array.isArray(orders) ? orders : [];
  const size = Number.isFinite(limit) && limit > 0 ? limit : RECENT_ORDERS_LIMIT;
  return list.slice(0, size);
};

export const filterCustomerOrdersByStatus = (orders, filter) => {
  const list = Array.isArray(orders) ? orders : [];
  if (!filter || filter === 'All') return list;
  return list.filter((order) => order.orderStatus === filter);
};

export const formatCompactOrderDate = (order) => {
  const millis = Number(order?.sortMillis) || 0;
  if (!millis) return order?.dateLabel || '';
  return new Date(millis).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
};

export const formatOrderRupees = (value) => {
  const n = Number(value);
  const amount = Number.isFinite(n) && n >= 0 ? n : 0;
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `₹${rounded.toLocaleString('en-IN')}`;
  }
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const getOrderItemsColumnLabel = (order) => {
  const count = Array.isArray(order?.items) ? order.items.length : 0;
  if (count > 0) return `${count} item${count === 1 ? '' : 's'}`;
  if (typeof order?.itemSummary === 'string' && order.itemSummary.trim()) {
    return order.itemSummary.trim();
  }
  return '—';
};

export const getOrderStatusBadgeClass = (status) => {
  switch (status) {
    case 'Delivered':
      return 'bg-green-100 text-green-800';
    case 'Cancelled':
      return 'bg-red-100 text-red-800';
    case 'Out for Delivery':
      return 'bg-blue-100 text-blue-800';
    case 'Preparing':
      return 'bg-yellow-100 text-yellow-800';
    case 'Processing':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const formatOrderNumber = (order) => {
  const shortId = typeof order?.shortOrderId === 'string' ? order.shortOrderId.trim() : '';
  if (shortId) return `#${shortId}`;
  const orderId = typeof order?.orderId === 'string' ? order.orderId.trim() : '';
  return orderId ? `#${orderId}` : 'Order';
};
