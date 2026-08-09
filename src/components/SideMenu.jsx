import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiMenu,
  FiX,
  FiLogOut,
  FiSettings,
  FiShoppingBag,
  FiPackage,
  FiTrendingUp,
  FiStar,
  FiHome,
  FiTag,
  FiDatabase,
  FiActivity,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const menuItems = [
  { id: 'fishes', label: 'Fish Management', icon: FiPackage },
  { id: 'orders', label: 'Orders', icon: FiShoppingBag },
  { id: 'stock', label: 'Daily Stock', icon: FiDatabase },
  { id: 'bulkRates', label: 'Bulk Rate Update', icon: FiTrendingUp },
  { id: 'rates', label: 'Rate History', icon: FiActivity },
  { id: 'reviews', label: 'Reviews', icon: FiStar },
  { id: 'shop', label: 'Shop Settings', icon: FiHome },
  { id: 'promotions', label: 'Promotions', icon: FiTag },
  { id: 'backup', label: 'Backup & Restore', icon: FiSettings },
  { id: 'diagnostics', label: 'Diagnostics', icon: FiSettings },
];

const SideMenu = ({ onNavigate, onLogout, isOpen: externalOpen, onClose, adminInfo = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const open = typeof externalOpen === 'boolean' ? externalOpen : isOpen;
  const setOpen = (value) => {
    if (typeof externalOpen === 'boolean' && typeof onClose === 'function') {
      if (!value) onClose();
    } else {
      setIsOpen(value);
    }
  };

  const handleNavigate = (target) => {
    if (typeof onNavigate === 'function') {
      onNavigate(target);
    }
    setOpen(false);
  };

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
    } else {
      navigate('/'); // Fallback
    }
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 bg-white text-gray-800 p-3 rounded-full shadow-lg z-50 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <FiMenu size={22} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.35 }}
            className="fixed top-0 right-0 h-full w-72 sm:w-80 backdrop-blur-lg bg-gradient-to-b from-blue-700/90 via-blue-600/85 to-cyan-400/80 text-white z-50 rounded-l-2xl shadow-2xl flex flex-col justify-between"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-5 left-5 text-white hover:text-blue-200 transition-colors"
              aria-label="Close menu"
            >
              <FiX size={26} />
            </button>

            <div className="p-6 pt-16 flex flex-col items-center text-center space-y-2">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md mb-3">
                <span className="text-blue-600 font-bold text-2xl">
                  {(adminInfo.name || 'Admin').charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="font-semibold text-xl text-white">{adminInfo.name || 'PR Nexus FishMart Admin'}</h3>
              {adminInfo.email && <p className="text-sm text-white/80">{adminInfo.email}</p>}
            </div>

            <div className="flex flex-col gap-2 px-6 text-base font-medium overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon || FiSettings;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className="w-full text-left px-3 py-3 rounded-lg text-white/90 hover:bg-white/20 font-medium transition-all flex items-center gap-3"
                  >
                    <Icon className="text-white/70 shrink-0" size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-6 border-t border-white/20 flex justify-between items-center">
              <span className="text-sm text-white/80">Logout</span>
              <button
                onClick={handleLogout}
                className="bg-white text-blue-600 px-4 py-2 rounded-full font-semibold flex items-center gap-2 hover:bg-blue-50 transition-all"
              >
                <FiLogOut />
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SideMenu;
