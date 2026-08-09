import React from "react";

const SmartBanner = ({ fishData }) => {
  const fishes = Array.isArray(fishData?.fishes)
    ? fishData.fishes.filter((fish) => fish.inStock !== false && fish.available !== false)
    : [];
  const marqueeItems = fishes.length > 0 ? [...fishes, ...fishes] : [];
  const animationDurationSeconds = Math.max(marqueeItems.length * 3, 18);
  const shouldAnimate = marqueeItems.length > 1;

  return (
    <div
      className="relative rounded-2xl shadow-lg p-4 sm:p-5 lg:p-6 text-white overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, #087EA4 0%, #0B9B9B 100%)',
      }}
    >
      {/* Mobile-First Responsive Layout */}
      <div className="flex flex-col sm:flex-row items-center h-full gap-4 sm:gap-0">
        {/* Column 1: Evening Selection - Mobile: Full width, Desktop: 15% */}
        <div className="w-full sm:w-[15%] flex flex-col justify-center text-center sm:text-left">
          <h2 className="text-lg sm:text-base font-bold">🌙 Evening Selection</h2>
          <p className="text-sm sm:text-xs text-cyan-50/95">Perfect for dinner tonight</p>
        </div>

        {/* Column 2: Fish Scrolling Details - Mobile: Full width, Desktop: 70% */}
        <div className="w-full sm:w-[70%] px-2 sm:px-4">
          <div className="relative w-full bg-white/15 rounded-xl py-2 overflow-x-auto sm:overflow-hidden">
            <div
              className={`flex whitespace-nowrap gap-4 sm:gap-8 px-2 sm:px-4 ${
                shouldAnimate ? 'animate-scroll-x' : ''
              }`}
              style={{
                minWidth: 'max-content',
                '--marquee-duration': `${animationDurationSeconds}s`,
                animationDuration: `${animationDurationSeconds}s`,
                animationPlayState: shouldAnimate ? 'running' : 'paused',
              }}
            >
              {marqueeItems.map((fish, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 sm:gap-3 bg-white/90 text-slate-800 px-3 sm:px-6 py-2 rounded-lg shadow-sm border border-white/80 hover:bg-white transition-all duration-300 min-w-[180px]"
                >
                  <span className="text-sm sm:text-base font-semibold truncate max-w-[120px] sm:max-w-none text-slate-800">
                    {fish.name}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-[#087EA4]">₹{fish.rate}</span>
                  <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-800 font-medium">
                    In Stock
                  </span>
                </div>
              ))}
            </div>

            {/* Fading edges for visual polish */}
            {shouldAnimate && (
              <>
                <div
                  className="absolute left-0 top-0 w-10 sm:w-20 h-full pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, #087EA4 0%, transparent 100%)' }}
                />
                <div
                  className="absolute right-0 top-0 w-10 sm:w-20 h-full pointer-events-none"
                  style={{ background: 'linear-gradient(270deg, #0B9B9B 0%, transparent 100%)' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Column 3: Live Status - Mobile: Full width, Desktop: 15% */}
        <div className="w-full sm:w-[15%] flex flex-col items-center sm:items-end justify-center text-sm text-cyan-50">
          <span className="flex items-center gap-1">
            ⭐ Live {new Date().toLocaleTimeString()}
          </span>
          <span className="text-xs text-cyan-100/90">Auto-updating</span>
        </div>
      </div>

      {/* Footer - Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-cyan-50 mt-3 sm:mt-2 gap-2 sm:gap-0">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span> Live Stock
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-sky-300 rounded-full"></span> Fresh Daily
        </span>
      </div>
    </div>
  );
};

export default SmartBanner;
