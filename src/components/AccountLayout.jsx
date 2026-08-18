import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const NAV_LINKS = [
  { to: '/account', id: 'overview', label: 'Overview', emoji: '👤', end: true },
  { to: '/account/orders', id: 'orders', label: 'My Orders', emoji: '📦' },
  { to: '/account/addresses', id: 'addresses', label: 'Addresses', emoji: '📍' },
];

const COMING_SOON = [
  { id: 'favourites', label: 'Favourites', emoji: '❤️' },
  { id: 'rewards', label: 'Rewards', emoji: '🎁' },
];

const PAGE_TITLES = {
  overview: 'Overview',
  orders: 'My Orders',
  addresses: 'Addresses',
};

const navClass = ({ isActive }) =>
  `flex items-center gap-3 w-full min-h-[48px] px-3 py-2.5 rounded-xl text-left font-medium whitespace-normal ${
    isActive
      ? 'bg-cyan-50 text-gray-900 font-semibold'
      : 'text-gray-800 hover:bg-cyan-50'
  } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40`;

const AccountNavItems = ({ onNavigate, onLogout, loggingOut }) => (
  <>
    <ul className="space-y-1">
      {NAV_LINKS.map((item) => (
        <li key={item.id}>
          <NavLink
            to={item.to}
            end={Boolean(item.end)}
            className={navClass}
            onClick={onNavigate}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <span>{item.label}</span>
          </NavLink>
        </li>
      ))}
      {COMING_SOON.map((item) => (
        <li key={item.id}>
          <div className="flex items-start gap-3 min-h-[48px] px-3 py-2.5 text-gray-800">
            <span aria-hidden="true">{item.emoji}</span>
            <span className="flex min-w-0 flex-col leading-snug">
              <span className="font-medium">{item.label}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Coming Soon
              </span>
            </span>
          </div>
        </li>
      ))}
      <li>
        <Link
          to="/contact"
          onClick={onNavigate}
          className="flex items-center gap-3 w-full min-h-[48px] px-3 py-2.5 rounded-xl text-gray-800 font-medium hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
        >
          <span aria-hidden="true">💬</span>
          <span>Help &amp; Support</span>
        </Link>
      </li>
    </ul>
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl text-left font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-60"
      >
        {loggingOut ? 'Logging out…' : 'Logout'}
      </button>
    </div>
  </>
);

const AccountLayout = ({ current, children }) => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

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

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [current]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-cyan-50 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8">
        <div className="lg:grid lg:grid-cols-[minmax(13.5rem,16rem)_minmax(0,1fr)] lg:gap-6 lg:items-start">
          <aside className="hidden lg:block">
            <nav
              className="sticky top-24 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              aria-label="Account navigation"
            >
              <p className="px-3 pt-1 pb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                My Account
              </p>
              <AccountNavItems
                onNavigate={closeMenu}
                onLogout={handleLogout}
                loggingOut={loggingOut}
              />
            </nav>
          </aside>

          <div className="min-w-0 space-y-3 sm:space-y-4">
            <div className="lg:hidden flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">
                {PAGE_TITLES[current] || 'My Account'}
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#087EA4] px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                aria-label="Account menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
              >
                Menu
              </button>
            </div>

            {menuOpen ? (
              <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Account menu">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Close account menu"
                  onClick={closeMenu}
                />
                <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
                  <div className="flex items-center justify-between gap-3 px-1 pb-2">
                    <p className="text-sm font-semibold text-gray-900">My Account</p>
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                    >
                      Close
                    </button>
                  </div>
                  <AccountNavItems
                    onNavigate={closeMenu}
                    onLogout={handleLogout}
                    loggingOut={loggingOut}
                  />
                </div>
              </div>
            ) : null}

            {children}

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

export default AccountLayout;
