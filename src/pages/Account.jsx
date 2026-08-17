import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import EnhancedLoadingSpinner from '../components/EnhancedLoadingSpinner';
import { getAccountRedirectPath } from '../services/customerSession';

const COMING_SOON_NAV = [
  { id: 'orders', emoji: '📦', label: 'My Orders', hint: 'View your FishMart orders' },
  { id: 'reorder', emoji: '🔁', label: 'Buy Again', hint: 'Quickly reorder your favourites' },
  { id: 'favourites', emoji: '❤️', label: 'Favourites', hint: 'Your saved fish & seafood' },
  { id: 'addresses', emoji: '📍', label: 'Addresses', hint: 'Manage delivery addresses' },
  { id: 'rewards', emoji: '🎁', label: 'Rewards', hint: 'Offers and loyalty, coming later' },
];

const Account = () => {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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

  return (
    <div className="min-h-screen bg-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
                {COMING_SOON_NAV.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex items-center justify-between w-full gap-3 px-3 py-3 min-h-[48px] rounded-xl text-left text-gray-400 cursor-not-allowed"
                    >
                      <span className="flex items-center gap-3">
                        <span aria-hidden="true">{item.emoji}</span>
                        {item.label}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        Soon
                      </span>
                    </button>
                  </li>
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

          <div className="space-y-6">
            <section className="card p-6 sm:p-8">
              <p className="text-sm font-semibold text-[#087EA4]">FishMart Account</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">
                Welcome back to FishMart
              </h1>
              <p className="mt-3 text-gray-600 max-w-2xl">
                Your mobile account is ready. Browse today’s catch, or pick up where you left off.
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2 text-sm font-semibold text-green-800">
                <span aria-hidden="true">✓</span>
                Mobile account verified
              </p>
            </section>

            <section aria-labelledby="account-actions-heading">
              <h2 id="account-actions-heading" className="text-lg font-bold text-gray-900 mb-3">
                Coming soon
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                to="/"
                className="btn-primary min-h-[48px] inline-flex items-center justify-center text-center"
              >
                Continue Shopping
              </Link>
              <Link
                to="/contact"
                className="min-h-[48px] inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold bg-white text-gray-900 border border-gray-200 shadow-sm hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
              >
                Help &amp; Support
              </Link>
            </section>

            <div className="lg:hidden bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-2">
              <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Account
              </p>
              {COMING_SOON_NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="flex items-center justify-between w-full min-h-[48px] px-3 py-3 rounded-xl text-left text-gray-400 cursor-not-allowed"
                >
                  <span className="flex items-center gap-3 font-medium">
                    <span aria-hidden="true">{item.emoji}</span>
                    {item.label}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Soon</span>
                </button>
              ))}
              <Link
                to="/contact"
                className="flex items-center gap-3 min-h-[48px] px-3 py-3 rounded-xl font-medium text-gray-800 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
              >
                <span aria-hidden="true">💬</span>
                Help &amp; Support
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full min-h-[48px] px-3 py-3 rounded-xl text-left font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-60"
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
