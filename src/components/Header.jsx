import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header = ({ shopInfo, cartCount = 0, onCartClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Fish' },
    { path: '/home', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  const isActivePath = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/fish';
    return location.pathname === path;
  };

  return (
    <header className="fm-header sticky top-0 z-50 bg-white border-b border-slate-200/80 shadow-sm overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[64px] sm:h-[72px] min-h-0">
          {/* Logo */}
          <Link
            to="/"
            className="fm-header-logo flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2 sm:mr-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40 focus-visible:ring-offset-2 rounded-lg"
          >
            <div className="fm-header-logo-mark relative flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-[#087EA4] to-[#0B9B9B] rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-lg sm:text-xl leading-none" aria-hidden="true">
                🐟
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-[#0c4a6e] truncate leading-tight">
                {shopInfo.name}
              </h1>
              <p className="hidden sm:block text-[10px] sm:text-xs text-[#087EA4] font-medium mt-0.5 truncate">
                🌅 Fresh Every Morning
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1" aria-label="Primary">
            {navItems.map((item) => {
              const active = isActivePath(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`fm-nav-link ${active ? 'fm-nav-link--active' : ''}`}
                >
                  <span className="fm-nav-link-label">{item.label}</span>
                  <span className="fm-nav-link-underline" aria-hidden="true" />
                </Link>
              );
            })}

            <a
              href={`https://wa.me/${shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fm-header-whatsapp hidden lg:inline-flex items-center gap-2 ml-2 px-4 py-2.5 bg-[#16a34a] text-white text-sm font-semibold rounded-xl shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-2"
            >
              <span className="text-base leading-none" aria-hidden="true">
                💬
              </span>
              <span>WhatsApp Now</span>
            </a>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCartClick) {
                  onCartClick();
                }
              }}
              className="fm-header-cart relative ml-1 p-2 text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40 focus-visible:ring-offset-2 rounded-lg"
              aria-label="Shopping cart"
            >
              <span className="text-[26px] leading-none block" aria-hidden="true">
                🛒
              </span>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#087EA4] text-white text-[11px] rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </nav>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
            {cartCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCartClick) {
                    onCartClick();
                  }
                }}
                className="fm-header-tap relative bg-[#087EA4] text-white rounded-xl p-2.5 shadow-sm min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40"
                title={`${cartCount} items in cart`}
                aria-label={`Shopping cart, ${cartCount} items`}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  🛒
                </span>
                <span className="absolute -top-1 -right-1 bg-white text-[#087EA4] border border-[#087EA4]/30 text-[11px] rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="fm-header-tap p-2.5 text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40 rounded-lg"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden" id="mobile-navigation" role="navigation" aria-label="Mobile navigation menu">
            <div className="px-1 pt-1 pb-3 space-y-0.5 border-t border-slate-200/80">
              {navItems.map((item) => {
                const active = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`fm-mobile-nav-link ${active ? 'fm-mobile-nav-link--active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <a
                href={`https://wa.me/${shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fm-header-tap flex items-center justify-center gap-2 mx-1 mt-2 px-4 py-3 min-h-[48px] bg-[#16a34a] text-white rounded-xl font-semibold shadow-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  💬
                </span>
                <span>WhatsApp Now</span>
              </a>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCartClick) {
                    onCartClick();
                  }
                  setIsMenuOpen(false);
                }}
                className="fm-header-tap flex items-center justify-between w-full mt-1 px-3 py-3 min-h-[48px] text-base font-semibold text-slate-800 rounded-lg"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl leading-none" aria-hidden="true">
                    🛒
                  </span>
                  <span>Shopping Cart</span>
                </span>
                {cartCount > 0 && (
                  <span className="bg-[#087EA4] text-white text-xs rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
