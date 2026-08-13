import { Smartphone, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';

const isAndroidVisitor = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
};

const AndroidAppPromo = () => {
  const location = useLocation();
  const [dismissed, setDismissed] = useLocalStorage('androidAppPromoDismissed', false);

  if (dismissed || location.pathname === '/admin' || !isAndroidVisitor()) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="PR Nexus FishMart Android app"
      className="bg-gradient-to-r from-[#087EA4] to-[#0B9B9B] text-white border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center"
          aria-hidden="true"
        >
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">PR Nexus FishMart App</p>
          <p className="text-xs text-cyan-50/95 leading-tight mt-0.5">
            Coming Soon on Google Play
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="Dismiss Android app promotion"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default AndroidAppPromo;
