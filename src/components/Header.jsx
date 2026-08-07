import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header = ({ shopInfo, cartCount = 0, onCartClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Fish' },
    { path: '/home', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' }
  ];

  const isActivePath = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/fish';
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 shadow-lg border-b border-gray-200/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-2.5 sm:py-4">
          {/* Enhanced Logo */}
          <Link to="/" className="flex items-center space-x-2 sm:space-x-4 group min-w-0 flex-1 mr-2">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg sm:shadow-xl group-hover:shadow-2xl transition-all duration-500 transform group-hover:scale-110 group-hover:rotate-3">
                <span className="text-white text-lg sm:text-2xl">🐟</span>
              </div>
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 border-blue-400/30 group-hover:border-blue-400/60 transition-all duration-500 group-hover:scale-110 hidden sm:block"></div>
            </div>
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-base sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent truncate">
                {shopInfo.name}
              </h1>
              <p className="hidden xs:inline-block sm:inline-block text-[10px] sm:text-sm text-gray-600 font-medium bg-blue-50 text-blue-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                🌅 Fresh Every Morning
              </p>
            </div>
          </Link>

          {/* Enhanced Desktop Navigation */}
          <nav className="hidden md:flex space-x-2 items-center">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 group ${
                  isActivePath(item.path)
                    ? 'text-white bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <span className="relative z-10">{item.label}</span>
                {isActivePath(item.path) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
            ))}
            
            {/* Enhanced WhatsApp Button */}
            <a
              href={`https://wa.me/${shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <span className="text-lg">💬</span>
              <span className="font-bold">WhatsApp Now</span>
            </a>
            
            {/* Enhanced Cart Icon */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCartClick) {
                  onCartClick();
                }
              }}
              className="relative p-3 text-gray-700 hover:text-blue-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-xl hover:bg-blue-50 group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform duration-300">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-bounce shadow-lg">
                  {cartCount}
                </span>
              )}
            </button>
          </nav>

          {/* Enhanced Mobile menu button with floating cart badge */}
          <div className="md:hidden flex items-center space-x-3">
            {/* Floating Cart Badge - Always Visible on Mobile */}
            {cartCount > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCartClick) {
                    onCartClick();
                  }
                }}
                className="relative bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 animate-pulse"
                title={`${cartCount} items in cart`}
              >
                <span className="text-xl">🛒</span>
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-lg animate-bounce">
                  {cartCount}
                </span>
              </button>
            )}
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-3 text-gray-700 hover:text-blue-600 focus:outline-none focus:text-blue-600 rounded-xl hover:bg-blue-50 transition-all duration-300"
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              <svg className="h-6 w-6 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Enhanced Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden animate-fade-in-up" id="mobile-navigation" role="navigation" aria-label="Mobile navigation menu">
            <div className="px-4 pt-4 pb-6 space-y-3 bg-gradient-to-br from-blue-50 to-cyan-50 border-t border-blue-200/30">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-3 rounded-xl text-base font-bold transition-all duration-300 ${
                    isActivePath(item.path)
                      ? 'text-white bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-white/80'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile WhatsApp Button */}
              <a
                href={`https://wa.me/${shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">💬</span>
                <span>WhatsApp Now</span>
              </a>
              
              {/* Enhanced Mobile Cart Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCartClick) {
                    onCartClick();
                  }
                  setIsMenuOpen(false);
                }}
                className="flex items-center justify-between w-full px-4 py-3 bg-white rounded-xl text-base font-bold text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <span className="flex items-center space-x-3">
                  <span className="text-xl">🛒</span>
                  <span>Shopping Cart</span>
                </span>
                {cartCount > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-lg">
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

