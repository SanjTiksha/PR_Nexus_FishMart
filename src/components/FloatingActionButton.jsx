import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const FloatingActionButton = ({ children, position = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [bottomOffset, setBottomOffset] = useState('calc(3rem + 50px)');
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOffset = () => {
      if (window.innerWidth < 768) {
        setBottomOffset('calc(3rem + 60px)');
      } else {
        setBottomOffset('3rem');
      }
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  if (location.pathname === '/admin') {
    return null;
  }

  const positionClasses = {
    'bottom-right': 'right-3 sm:right-6',
    'bottom-left': 'left-3 sm:left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const isBottomPosition = position.includes('bottom');
  const containerStyle = isBottomPosition
    ? { bottom: bottomOffset, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }
    : undefined;

  return (
    <div className={`fixed ${positionClasses[position]} z-40`} style={containerStyle}>
      <div className={`transition-all duration-300 ${isOpen ? 'space-y-3' : 'space-y-0'}`}>
        <div className={`flex flex-col space-y-3 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          {children}
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-12 h-12 sm:w-14 sm:h-14 bg-red-500 text-white rounded-full shadow-lg active:bg-red-700 hover:bg-red-600 hover:shadow-xl transition-all duration-300 flex items-center justify-center ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
          aria-label="Toggle actions"
        >
          <span className="text-xl sm:text-2xl">{isOpen ? '✕' : '+'}</span>
        </button>
      </div>
    </div>
  );
};

export default FloatingActionButton;
