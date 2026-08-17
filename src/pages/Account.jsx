import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
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

const COMING_SOON_NAV = [
  { id: 'reorder', emoji: '🔄', label: 'Buy Again', hint: 'Quickly reorder your favourites' },
  { id: 'favourites', emoji: '❤️', label: 'Favourites', hint: 'Your saved fish & seafood' },
  { id: 'rewards', emoji: '🎁', label: 'Rewards', hint: 'Offers and loyalty, coming later' },
];

const formatAccountVerifiedMobile = (mobile10) => {
  if (typeof mobile10 !== 'string' || !/^[6-9]\d{9}$/.test(mobile10)) return '';
  return `+91 ${mobile10.slice(0, 2)}****${mobile10.slice(-2)}`;
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

const Account = () => {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUpdateMessage, setProfileUpdateMessage] = useState('');

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileSaveError(PROFILE_SAVE_UNAVAILABLE_MESSAGE);
        }
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
        setDisplayName(
          result.profile && typeof result.profile.displayName === 'string'
            ? result.profile.displayName
            : '',
        );
        setProfileUpdateMessage('Profile saved.');
      } else {
        setProfileUpdateMessage(PROFILE_UPDATE_UNAVAILABLE_MESSAGE);
      }
    } catch {
      setProfileUpdateMessage(PROFILE_UPDATE_UNAVAILABLE_MESSAGE);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLogoutError('');
    setLoggingOut(true);
    try {
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch {
      setLoggingOut(false);
      setLogoutError('Unable to log out. Please try again.');
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

  return (
    <div className="min-h-screen bg-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:items-start">
          <aside className="hidden lg:block">
            <nav
              className="card p-4 sticky top-24"
              aria-label="Account navigation"
            >
              <p className="px-3 pt-1 pb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                My Account
              </p>
              <ul className="space-y-1">
                <li>
                  <span
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl bg-cyan-50 text-gray-900 font-semibold"
                    aria-current="page"
                  >
                    <span aria-hidden="true">👤</span>
                    Overview
                  </span>
                </li>
                <li>
                  <Link
                    to="/account/orders"
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl text-gray-800 font-medium hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                  >
                    <span aria-hidden="true">📦</span>
                    My Orders
                  </Link>
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
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full min-h-[48px] px-3 py-3 rounded-xl text-left font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-60"
                >
                  {loggingOut ? 'Logging out…' : 'Logout'}
                </button>
              </div>
            </nav>
          </aside>

          <div className="space-y-4 lg:space-y-6">
            <section className="card p-5 sm:p-6 lg:p-8">
              <p className="text-sm font-semibold text-[#087EA4]">FishMart Account</p>
              <h1 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-snug">
                Welcome back to FishMart
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
                Your mobile account is ready. Browse today’s catch, or pick up where you left off.
              </p>
              {maskedMobile ? (
                <p className="mt-4 text-sm sm:text-base font-semibold text-green-800">
                  <span aria-hidden="true">✓ </span>
                  Mobile verified · {maskedMobile}
                </p>
              ) : null}
              {profileSaveError ? (
                <p className="mt-3 text-sm text-gray-600" role="status">
                  {profileSaveError}
                </p>
              ) : null}
              <Link
                to="/"
                className="mt-5 flex w-full max-w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#087EA4] px-6 py-3 text-center text-base font-bold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40 focus-visible:ring-offset-2 active:opacity-90 lg:w-auto lg:min-w-[240px]"
              >
                Continue Shopping
              </Link>
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900">Your Profile</h2>
              <p className="mt-1 text-sm text-gray-600">
                Optional. You can keep shopping without adding a name.
              </p>
              <form className="mt-4 space-y-3" onSubmit={handleSaveDisplayName}>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Name</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your name"
                    className="mt-1 w-full min-h-[48px] rounded-2xl border border-gray-200 px-4 text-base text-gray-900"
                  />
                </label>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#087EA4] px-6 text-base font-bold text-white disabled:opacity-60 lg:w-auto lg:min-w-[160px]"
                >
                  {profileSaving ? 'Saving…' : 'Save'}
                </button>
                {profileUpdateMessage ? (
                  <p className="text-sm text-gray-600" role="status">
                    {profileUpdateMessage}
                  </p>
                ) : null}
              </form>
            </section>

            <section className="lg:hidden" aria-labelledby="account-features-heading">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-3 sm:p-4">
                <h2
                  id="account-features-heading"
                  className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Account
                </h2>
                <ul>
                  <li>
                    <Link
                      to="/account/orders"
                      className="flex items-center justify-between gap-3 min-h-[48px] px-3 py-2 rounded-xl font-medium text-gray-800 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true">📦</span>
                        <span className="truncate">My Orders</span>
                      </span>
                      <span className="shrink-0 text-gray-400" aria-hidden="true">
                        ›
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/account/addresses"
                      className="flex items-center justify-between gap-3 min-h-[48px] px-3 py-2 rounded-xl font-medium text-gray-800 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true">📍</span>
                        <span className="truncate">Addresses</span>
                      </span>
                      <span className="shrink-0 text-gray-400" aria-hidden="true">
                        ›
                      </span>
                    </Link>
                  </li>
                  {COMING_SOON_NAV.map((item) => (
                    <ComingSoonRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            </section>

            <section
              className="hidden lg:block"
              aria-labelledby="account-actions-heading"
            >
              <h2 id="account-actions-heading" className="text-lg font-bold text-gray-900 mb-3">
                Account
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Link
                  to="/account/orders"
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                >
                  <p className="text-2xl" aria-hidden="true">
                    📦
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-gray-900">My Orders</h3>
                  <p className="mt-1 text-sm text-gray-600">View your FishMart orders</p>
                </Link>
                <Link
                  to="/account/addresses"
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                >
                  <p className="text-2xl" aria-hidden="true">
                    📍
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-gray-900">Addresses</h3>
                  <p className="mt-1 text-sm text-gray-600">Manage delivery addresses</p>
                </Link>
                {COMING_SOON_NAV.filter((item) => item.id !== 'rewards').map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6"
                  >
                    <p className="text-2xl" aria-hidden="true">
                      {item.emoji}
                    </p>
                    <h3 className="mt-3 text-lg font-bold text-gray-900">{item.label}</h3>
                    <p className="mt-1 text-sm text-gray-600">{item.hint}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Coming soon
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="lg:hidden space-y-3">
              <Link
                to="/contact"
                className="flex w-full min-h-[48px] items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-3 text-center font-bold text-gray-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
              >
                Help &amp; Support
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full min-h-[48px] rounded-2xl px-6 py-3 text-center font-semibold text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-60"
              >
                {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>

            {logoutError ? (
              <p className="text-sm text-red-700" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
