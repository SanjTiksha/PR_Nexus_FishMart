import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import AccountLayout from '../components/AccountLayout';
import { AccountStatusBadge } from '../components/AccountOrderCard';
import EnhancedLoadingSpinner from '../components/EnhancedLoadingSpinner';
import { getAccountRedirectPath } from '../services/customerSession';
import {
  PROFILE_SAVE_UNAVAILABLE_MESSAGE,
  PROFILE_UPDATE_UNAVAILABLE_MESSAGE,
  ensureCustomerProfile,
  getCustomerIdentityFromUser,
  getCustomerProfile,
  updateCustomerProfile,
} from '../services/customerProfile';
import { getMyOrders } from '../services/customerOrders';
import { getCustomerAddresses } from '../services/customerAddresses';
import {
  formatAccountVerifiedMobile,
  formatCompactOrderDate,
  formatOrderNumber,
  formatOrderRupees,
  getAccountWelcomeTitle,
  getActiveCustomerOrders,
  getOrderItemsColumnLabel,
  getRecentCustomerOrders,
} from '../services/customerAccountDashboard';

const panelClass = 'rounded-xl border border-gray-200 bg-white p-3 sm:p-4';
const actionLinkClass =
  'inline-flex min-h-[44px] lg:min-h-[32px] items-center justify-center text-sm font-semibold text-[#087EA4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40';
const quickActionClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40';

const getActiveOrderMeta = (order) => {
  const dateLabel = formatCompactOrderDate(order);
  const itemLabel =
    typeof order?.itemSummary === 'string' && order.itemSummary.trim()
      ? order.itemSummary.trim()
      : getOrderItemsColumnLabel(order);
  if (dateLabel && itemLabel) return `${itemLabel} · ${dateLabel}`;
  return dateLabel || itemLabel || '—';
};

const Account = () => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUpdateMessage, setProfileUpdateMessage] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoadStatus, setOrdersLoadStatus] = useState('loading');
  const [addressCount, setAddressCount] = useState(0);
  const [addressesLoadStatus, setAddressesLoadStatus] = useState('loading');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return undefined;
    if (getAccountRedirectPath(firebaseUser)) return undefined;

    let cancelled = false;
    setProfileSaveError('');
    setOrdersLoadStatus('loading');
    setAddressesLoadStatus('loading');

    ensureCustomerProfile(firebaseUser)
      .then(async (result) => {
        if (cancelled) return;
        if (result.status === 'unavailable') {
          setProfileSaveError(PROFILE_SAVE_UNAVAILABLE_MESSAGE);
        }
        const loaded = await getCustomerProfile(firebaseUser);
        if (cancelled) return;
        if (loaded.profile && typeof loaded.profile.displayName === 'string') {
          setDisplayName(loaded.profile.displayName);
          setSavedDisplayName(loaded.profile.displayName);
        } else {
          setDisplayName('');
          setSavedDisplayName('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileSaveError(PROFILE_SAVE_UNAVAILABLE_MESSAGE);
        }
      });

    getMyOrders(firebaseUser).then((result) => {
      if (cancelled) return;
      setOrders(Array.isArray(result.orders) ? result.orders : []);
      setOrdersLoadStatus(result.status === 'unavailable' ? 'unavailable' : 'ok');
    });

    getCustomerAddresses(firebaseUser).then((result) => {
      if (cancelled) return;
      setAddressCount(Array.isArray(result.addresses) ? result.addresses.length : 0);
      setAddressesLoadStatus(result.status === 'unavailable' ? 'unavailable' : 'ok');
    });

    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser]);

  const handleSaveDisplayName = async (event) => {
    event.preventDefault();
    if (profileSaving) return;
    setProfileUpdateMessage('');
    setProfileSaving(true);
    try {
      const result = await updateCustomerProfile(firebaseUser, {
        displayName: displayName.trim() || null,
      });
      if (result.status === 'ok') {
        const nextName =
          result.profile && typeof result.profile.displayName === 'string'
            ? result.profile.displayName
            : '';
        setDisplayName(nextName);
        setSavedDisplayName(nextName);
        setProfileUpdateMessage('Profile saved.');
        setEditingProfile(false);
      } else {
        setProfileUpdateMessage(PROFILE_UPDATE_UNAVAILABLE_MESSAGE);
      }
    } catch {
      setProfileUpdateMessage(PROFILE_UPDATE_UNAVAILABLE_MESSAGE);
    } finally {
      setProfileSaving(false);
    }
  };

  if (!authReady) {
    return <EnhancedLoadingSpinner message="Loading your account..." size="large" />;
  }

  const accountRedirect = getAccountRedirectPath(firebaseUser);
  if (accountRedirect) {
    return <Navigate to={accountRedirect} replace />;
  }

  const customerIdentity = getCustomerIdentityFromUser(firebaseUser);
  const maskedMobile = customerIdentity
    ? formatAccountVerifiedMobile(customerIdentity.mobile10)
    : '';
  const welcomeTitle = getAccountWelcomeTitle(savedDisplayName);
  const ordersReady = ordersLoadStatus === 'ok';
  const addressesReady = addressesLoadStatus === 'ok';
  const activeOrders = ordersReady ? getActiveCustomerOrders(orders) : [];
  const recentOrders = ordersReady ? getRecentCustomerOrders(orders, 3) : [];
  const activeOrder = activeOrders[0] || null;

  return (
    <AccountLayout current="overview">
      <section className={panelClass}>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
          {welcomeTitle}
        </h1>
        {maskedMobile ? (
          <p className="mt-1 text-sm font-semibold text-green-800">
            <span aria-hidden="true">✓ </span>
            Mobile verified · {maskedMobile}
          </p>
        ) : null}
        {profileSaveError ? (
          <p className="mt-2 text-sm text-gray-600" role="status">
            {profileSaveError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setDisplayName(savedDisplayName);
            setProfileUpdateMessage('');
            setEditingProfile((open) => !open);
          }}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
        >
          {editingProfile ? 'Close' : 'Edit Profile'}
        </button>
        {editingProfile ? (
          <form className="mt-3 space-y-3" onSubmit={handleSaveDisplayName}>
            <label className="block">
              <span className="text-sm font-semibold text-gray-800">Name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                autoComplete="name"
                placeholder="Your name"
                className="mt-1 w-full min-h-[48px] rounded-xl border border-gray-200 px-4 text-base text-gray-900"
              />
            </label>
            <button
              type="submit"
              disabled={profileSaving}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#087EA4] px-6 text-base font-bold text-white disabled:opacity-60 sm:w-auto sm:min-w-[160px]"
            >
              {profileSaving ? 'Saving…' : 'Save'}
            </button>
            {profileUpdateMessage ? (
              <p className="text-sm text-gray-600" role="status">
                {profileUpdateMessage}
              </p>
            ) : null}
          </form>
        ) : null}
      </section>

      <section aria-label="Account summary">
        <div className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-2">
          <Link
            to="/account/orders"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 leading-tight">
              Total Orders
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {ordersReady ? orders.length : '—'}
            </p>
          </Link>
          <Link
            to="/account/orders"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 leading-tight">
              Active Orders
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {ordersReady ? activeOrders.length : '—'}
            </p>
          </Link>
          <Link
            to="/account/addresses"
            className="col-span-2 min-[380px]:col-span-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 leading-tight">
              Saved Addresses
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {addressesReady ? addressCount : '—'}
            </p>
          </Link>
        </div>
      </section>

      {activeOrder ? (
        <section className={`${panelClass} lg:py-3`} aria-label="Active order">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Active Order
          </p>

          <div className="mt-2 hidden lg:flex lg:items-center lg:gap-4">
            <p className="shrink-0 text-sm font-bold text-gray-900">
              {formatOrderNumber(activeOrder)}
            </p>
            <p className="min-w-0 flex-1 truncate text-sm text-gray-600">
              {getActiveOrderMeta(activeOrder)}
            </p>
            <p className="shrink-0 text-sm font-semibold text-gray-900">
              {formatOrderRupees(activeOrder.totalPrice)}
            </p>
            <AccountStatusBadge order={activeOrder} />
            <Link
              to="/account/orders"
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-lg bg-[#087EA4] px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
            >
              View Order
            </Link>
          </div>

          <div className="mt-2 lg:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{formatOrderNumber(activeOrder)}</p>
                <p className="mt-0.5 break-words text-sm text-gray-600">
                  {getActiveOrderMeta(activeOrder)}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatOrderRupees(activeOrder.totalPrice)}
                </p>
              </div>
              <AccountStatusBadge order={activeOrder} />
            </div>
            <Link
              to="/account/orders"
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#087EA4] px-4 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
            >
              View Order
            </Link>
          </div>
        </section>
      ) : null}

      <section className={panelClass} aria-label="Recent orders">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900">Recent Orders</h2>
          <Link to="/account/orders" className={actionLinkClass}>
            View All Orders →
          </Link>
        </div>

        {ordersLoadStatus === 'loading' ? (
          <p className="mt-2 text-sm text-gray-600">Loading your orders...</p>
        ) : null}
        {ordersLoadStatus === 'unavailable' ? (
          <p className="mt-2 text-sm text-gray-700" role="alert">
            We couldn&apos;t load your orders.
          </p>
        ) : null}
        {ordersReady && recentOrders.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No orders yet.</p>
        ) : null}

        {ordersReady && recentOrders.length > 0 ? (
          <>
            <div className="mt-2 hidden lg:block">
              <table className="w-full table-fixed text-sm">
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
                  {recentOrders.map((order) => (
                    <tr key={order.orderId} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-2 pr-3 font-semibold text-gray-900">
                        {formatOrderNumber(order)}
                      </td>
                      <td className="py-2 pr-3 text-gray-700">{formatCompactOrderDate(order)}</td>
                      <td className="py-2 pr-3 text-gray-700">{getOrderItemsColumnLabel(order)}</td>
                      <td className="py-2 pr-3 font-semibold text-gray-900">
                        {formatOrderRupees(order.totalPrice)}
                      </td>
                      <td className="py-2 pr-3">
                        <AccountStatusBadge order={order} />
                      </td>
                      <td className="py-2">
                        <Link to="/account/orders" className={actionLinkClass}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-2 space-y-2 lg:hidden">
              {recentOrders.map((order) => (
                <li
                  key={order.orderId}
                  className="rounded-lg border border-gray-100 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-bold text-gray-900">
                      {formatOrderNumber(order)}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {formatOrderRupees(order.totalPrice)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {formatCompactOrderDate(order)}
                    {' · '}
                    {getOrderItemsColumnLabel(order)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <AccountStatusBadge order={order} />
                    <Link to="/account/orders" className={actionLinkClass}>
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-label="Quick actions">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Link to="/" className={quickActionClass}>
            Shop Fish
          </Link>
          <Link to="/account/orders" className={quickActionClass}>
            My Orders
          </Link>
          <Link to="/account/addresses" className={quickActionClass}>
            Addresses
          </Link>
          <Link to="/contact" className={quickActionClass}>
            Help &amp; Support
          </Link>
        </div>
      </section>
    </AccountLayout>
  );
};

export default Account;
