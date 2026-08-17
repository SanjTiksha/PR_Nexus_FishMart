import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import EnhancedLoadingSpinner from '../components/EnhancedLoadingSpinner';
import { getAccountRedirectPath } from '../services/customerSession';
import {
  MY_ORDERS_EMPTY_MESSAGE,
  MY_ORDERS_EMPTY_TITLE,
  MY_ORDERS_START_SHOPPING_TO,
  MY_ORDERS_UNAVAILABLE_MESSAGE,
  getMyOrders,
} from '../services/customerOrders';
import { formatDeliveryPreferenceLabel } from '../utils/deliverySlot';
import { formatOrderDiscountLabel } from '../utils/orderFinancialDisplay';
import { calculateLineTotal, normalizeQuantity } from '../utils/quantityUtils';

const COMING_SOON_NAV = [
  { id: 'reorder', emoji: '🔄', label: 'Buy Again' },
  { id: 'favourites', emoji: '❤️', label: 'Favourites' },
  { id: 'rewards', emoji: '🎁', label: 'Rewards' },
];

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const statusBadgeClass = (status) => {
  switch (status) {
    case 'Delivered':
      return 'bg-green-100 text-green-800';
    case 'Cancelled':
      return 'bg-red-100 text-red-800';
    case 'Out for Delivery':
      return 'bg-blue-100 text-blue-800';
    case 'Preparing':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const ComingSoonRow = ({ item }) => (
  <li className="flex items-center justify-between gap-3 min-h-[48px] px-3 py-2">
    <span className="flex min-w-0 items-center gap-3 font-medium text-gray-800">
      <span aria-hidden="true">{item.emoji}</span>
      <span className="truncate">{item.label}</span>
    </span>
    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
      Coming soon
    </span>
  </li>
);

const OrderCard = ({ order, expanded, onToggle }) => {
  const slotLabel = formatDeliveryPreferenceLabel(order);
  const discountLabel = formatOrderDiscountLabel({
    discount: order.discount,
    offerName: order.offerName,
  });

  return (
    <article className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-gray-700">{order.dateLabel || 'Date unavailable'}</p>
        <span
          className={`shrink-0 inline-flex min-h-[28px] items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(order.orderStatus)}`}
        >
          {order.orderStatusLabel}
        </span>
      </div>

      <p className="mt-2 text-xl font-bold text-gray-900">{money(order.totalPrice)}</p>
      {order.itemSummary ? (
        <p className="mt-1 text-sm text-gray-700">{order.itemSummary}</p>
      ) : null}
      {slotLabel ? (
        <p className="mt-1 text-sm text-gray-600">{slotLabel}</p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-gray-500">
        {order.paymentLabel}
        {order.shortOrderId ? ` · #${order.shortOrderId}` : ''}
      </p>

      <button
        type="button"
        onClick={onToggle}
        className="mt-3 flex w-full min-h-[48px] items-center justify-center rounded-2xl border border-gray-200 bg-cyan-50 px-4 text-sm font-bold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
        aria-expanded={expanded}
      >
        {expanded ? 'Hide details' : 'View details'}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm">
          {order.items.length > 0 ? (
            <ul className="space-y-1">
              {order.items.map((item, index) => (
                <li key={`${order.orderId}-${item?.name || 'item'}-${index}`} className="flex justify-between gap-3">
                  <span className="min-w-0 text-gray-800">
                    {item?.name || 'Item'}
                    {item?.quantity != null || item?.qty != null
                      ? ` · ${normalizeQuantity(item.quantity ?? item.qty).toFixed(1)} kg`
                      : ''}
                  </span>
                  <span className="shrink-0 font-semibold text-gray-900">
                    {money(calculateLineTotal(item.price || item.rate, item.quantity ?? item.qty))}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1 text-gray-700">
            <div className="flex justify-between gap-3">
              <span>Subtotal</span>
              <span>{money(order.subtotal)}</span>
            </div>
            {order.discount > 0 ? (
              <div className="flex justify-between gap-3">
                <span>{discountLabel}</span>
                <span>-{money(order.discount)}</span>
              </div>
            ) : null}
            {order.deliveryCharge > 0 ? (
              <div className="flex justify-between gap-3">
                <span>Delivery</span>
                <span>{money(order.deliveryCharge)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 font-bold text-gray-900">
              <span>Total</span>
              <span>{money(order.totalPrice)}</span>
            </div>
          </div>

          {(order.deliveryName || order.deliveryAddress || order.deliveryMobileMasked) ? (
            <div className="rounded-2xl bg-green-50 p-3 text-green-900">
              {order.deliveryName ? <p className="font-semibold">{order.deliveryName}</p> : null}
              {order.deliveryMobileMasked ? <p>{order.deliveryMobileMasked}</p> : null}
              {order.deliveryAddress ? <p className="mt-1">{order.deliveryAddress}</p> : null}
            </div>
          ) : null}

          {order.paymentRef || order.transactionId ? (
            <p className="break-all text-xs text-gray-500">
              {order.paymentRef ? `Ref ${order.paymentRef}` : ''}
              {order.paymentRef && order.transactionId ? ' · ' : ''}
              {order.transactionId ? `UTR ${order.transactionId}` : ''}
            </p>
          ) : null}

          {order.orderId ? (
            <p className="break-all font-mono text-xs text-gray-400">{order.orderId}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

const CustomerOrders = () => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [orders, setOrders] = useState([]);
  const [expandedId, setExpandedId] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const loadOrders = useCallback(async (user) => {
    if (!user || getAccountRedirectPath(user)) {
      setOrders([]);
      setLoadStatus('ok');
      return;
    }

    setLoadStatus('loading');
    const result = await getMyOrders(user);
    setOrders(result.orders);
    setLoadStatus(result.status === 'unavailable' ? 'unavailable' : 'ok');
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;
    let cancelled = false;

    loadOrders(firebaseUser).then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser, loadOrders]);

  if (!authReady) {
    return <EnhancedLoadingSpinner message="Loading your orders..." size="large" />;
  }

  const accountRedirect = getAccountRedirectPath(firebaseUser);
  if (accountRedirect) {
    return <Navigate to={accountRedirect} replace />;
  }

  const showLoading = loadStatus === 'loading';
  const showError = loadStatus === 'unavailable';
  const showEmpty = !showLoading && !showError && orders.length === 0;

  return (
    <div className="min-h-screen bg-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:items-start">
          <aside className="hidden lg:block">
            <nav className="card p-4 sticky top-24" aria-label="Account navigation">
              <p className="px-3 pt-1 pb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                My Account
              </p>
              <ul className="space-y-1">
                <li>
                  <Link
                    to="/account"
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl text-gray-800 font-medium hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                  >
                    <span aria-hidden="true">👤</span>
                    Overview
                  </Link>
                </li>
                <li>
                  <span
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl bg-cyan-50 text-gray-900 font-semibold"
                    aria-current="page"
                  >
                    <span aria-hidden="true">📦</span>
                    My Orders
                  </span>
                </li>
                <li>
                  <Link
                    to="/account/addresses"
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl text-gray-800 font-medium hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                  >
                    <span aria-hidden="true">📍</span>
                    Addresses
                  </Link>
                </li>
                {COMING_SOON_NAV.map((item) => (
                  <ComingSoonRow key={item.id} item={item} />
                ))}
                <li>
                  <Link
                    to="/contact"
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl text-gray-800 font-medium hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                  >
                    <span aria-hidden="true">💬</span>
                    Help &amp; Support
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          <div className="space-y-4 lg:space-y-6">
            <section className="card p-5 sm:p-6 lg:p-8">
              <Link
                to="/account"
                className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#087EA4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
              >
                ← Account
              </Link>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">
                My Orders
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                Orders you placed while signed in.
              </p>
            </section>

            {showLoading ? (
              <section className="card p-6 text-center">
                <p className="text-base font-semibold text-gray-800">Loading your orders...</p>
              </section>
            ) : null}

            {showError ? (
              <section className="card p-6 text-center space-y-4">
                <p className="text-base font-semibold text-gray-900" role="alert">
                  {MY_ORDERS_UNAVAILABLE_MESSAGE}
                </p>
                <button
                  type="button"
                  onClick={() => loadOrders(firebaseUser)}
                  className="mx-auto flex w-full max-w-xs min-h-[48px] items-center justify-center rounded-2xl bg-[#087EA4] px-6 text-base font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                >
                  Retry
                </button>
              </section>
            ) : null}

            {showEmpty ? (
              <section className="card p-6 text-center space-y-4">
                <h2 className="text-xl font-bold text-gray-900">{MY_ORDERS_EMPTY_TITLE}</h2>
                <p className="text-sm sm:text-base text-gray-600">{MY_ORDERS_EMPTY_MESSAGE}</p>
                <Link
                  to={MY_ORDERS_START_SHOPPING_TO}
                  className="mx-auto flex w-full max-w-xs min-h-[48px] items-center justify-center rounded-2xl bg-[#087EA4] px-6 text-base font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                >
                  Start Shopping
                </Link>
              </section>
            ) : null}

            {!showLoading && !showError && orders.length > 0 ? (
              <section className="space-y-3" aria-label="Your orders">
                {orders.map((order) => (
                  <OrderCard
                    key={order.orderId}
                    order={order}
                    expanded={expandedId === order.orderId}
                    onToggle={() =>
                      setExpandedId((current) => (current === order.orderId ? '' : order.orderId))
                    }
                  />
                ))}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrders;
