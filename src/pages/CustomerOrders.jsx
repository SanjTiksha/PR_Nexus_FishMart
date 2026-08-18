import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import AccountLayout from '../components/AccountLayout';
import AccountOrderCard, { AccountStatusBadge } from '../components/AccountOrderCard';
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
import {
  ORDER_STATUS_FILTERS,
  filterCustomerOrdersByStatus,
  formatCompactOrderDate,
  formatOrderNumber,
  formatOrderRupees,
  getOrderItemsColumnLabel,
} from '../services/customerAccountDashboard';

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const OrderDetails = ({ order }) => {
  const slotLabel = formatDeliveryPreferenceLabel(order);
  const discountLabel = formatOrderDiscountLabel({
    discount: order.discount,
    offerName: order.offerName,
  });

  return (
    <div className="space-y-3 text-sm">
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

      {slotLabel ? <p className="text-gray-600">{slotLabel}</p> : null}

      {(order.deliveryName || order.deliveryAddress || order.deliveryMobileMasked) ? (
        <div className="rounded-xl bg-green-50 p-3 text-green-900">
          {order.deliveryName ? <p className="font-semibold">{order.deliveryName}</p> : null}
          {order.deliveryMobileMasked ? <p>{order.deliveryMobileMasked}</p> : null}
          {order.deliveryAddress ? <p className="mt-1 break-words">{order.deliveryAddress}</p> : null}
        </div>
      ) : null}

      {order.paymentLabel ? (
        <p className="text-xs font-medium text-gray-500">{order.paymentLabel}</p>
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
  );
};

const CustomerOrders = () => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [orders, setOrders] = useState([]);
  const [expandedId, setExpandedId] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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

  const visibleOrders = useMemo(
    () => filterCustomerOrdersByStatus(orders, statusFilter),
    [orders, statusFilter],
  );

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
  const showFilteredEmpty = !showLoading && !showError && orders.length > 0 && visibleOrders.length === 0;

  const toggleDetails = (orderId) => {
    setExpandedId((current) => (current === orderId ? '' : orderId));
  };

  return (
    <AccountLayout current="orders">
      <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">My Orders</h1>
        <p className="mt-1 text-sm text-gray-600">Orders you placed while signed in.</p>
      </section>

      {showLoading ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-base font-semibold text-gray-800">Loading your orders...</p>
        </section>
      ) : null}

      {showError ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 text-center space-y-4">
          <p className="text-base font-semibold text-gray-900" role="alert">
            {MY_ORDERS_UNAVAILABLE_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => loadOrders(firebaseUser)}
            className="mx-auto flex w-full max-w-xs min-h-[48px] items-center justify-center rounded-xl bg-[#087EA4] px-6 text-base font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
          >
            Retry
          </button>
        </section>
      ) : null}

      {showEmpty ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{MY_ORDERS_EMPTY_TITLE}</h2>
          <p className="text-sm sm:text-base text-gray-600">{MY_ORDERS_EMPTY_MESSAGE}</p>
          <Link
            to={MY_ORDERS_START_SHOPPING_TO}
            className="mx-auto flex w-full max-w-xs min-h-[48px] items-center justify-center rounded-xl bg-[#087EA4] px-6 text-base font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
          >
            Start Shopping
          </Link>
        </section>
      ) : null}

      {!showLoading && !showError && orders.length > 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5" aria-label="Your orders">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter orders">
            {ORDER_STATUS_FILTERS.map((filter) => {
              const selected = statusFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold ${
                    selected
                      ? 'bg-[#087EA4] text-white'
                      : 'border border-gray-200 bg-white text-gray-800'
                  }`}
                  aria-pressed={selected}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          {showFilteredEmpty ? (
            <p className="mt-4 text-sm text-gray-600">No orders with this status.</p>
          ) : null}

          <div className="mt-4 hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-semibold">Order</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Items</th>
                  <th className="py-2 pr-3 font-semibold">Amount</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const expanded = expandedId === order.orderId;
                  return (
                    <Fragment key={order.orderId}>
                      <tr className="border-b border-gray-50">
                        <td className="py-2.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">
                          {formatOrderNumber(order)}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700 whitespace-nowrap">
                          {formatCompactOrderDate(order)}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700">{getOrderItemsColumnLabel(order)}</td>
                        <td className="py-2.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">
                          {formatOrderRupees(order.totalPrice)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <AccountStatusBadge order={order} />
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleDetails(order.orderId)}
                            className="inline-flex min-h-[44px] items-center font-semibold text-[#087EA4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                            aria-expanded={expanded}
                          >
                            {expanded ? 'Hide details' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b border-gray-50 bg-gray-50/70">
                          <td colSpan={6} className="px-3 py-3">
                            <OrderDetails order={order} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 space-y-2 lg:hidden">
            {visibleOrders.map((order) => {
              const expanded = expandedId === order.orderId;
              return (
                <li key={order.orderId}>
                  <AccountOrderCard
                    order={order}
                    actionLabel={expanded ? 'Hide details' : 'View Details →'}
                    onAction={() => toggleDetails(order.orderId)}
                    expanded={expanded}
                  >
                    <OrderDetails order={order} />
                  </AccountOrderCard>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </AccountLayout>
  );
};

export default CustomerOrders;
