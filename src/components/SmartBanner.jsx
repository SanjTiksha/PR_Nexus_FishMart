import React from "react";

const SmartBanner = ({ fishData }) => {
  const fishes = Array.isArray(fishData?.fishes)
    ? fishData.fishes.filter((fish) => fish.inStock !== false && fish.available !== false)
    : [];
  const marqueeItems = fishes.length > 0 ? [...fishes, ...fishes] : [];
  const animationDurationSeconds = Math.max(marqueeItems.length * 3, 18);
  const shouldAnimate = marqueeItems.length > 1;

  return (
    <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg p-4 sm:p-5 lg:p-6 text-white overflow-hidden">
      {/* Mobile-First Responsive Layout */}
      <div className="flex flex-col sm:flex-row items-center h-full gap-4 sm:gap-0">
        {/* Column 1: Evening Selection - Mobile: Full width, Desktop: 15% */}
        <div className="w-full sm:w-[15%] flex flex-col justify-center text-center sm:text-left">
          <h2 className="text-lg sm:text-base font-bold">🌙 Evening Selection</h2>
          <p className="text-sm sm:text-xs text-purple-100">Perfect for dinner tonight</p>
        </div>

        {/* Column 2: Fish Scrolling Details - Mobile: Full width, Desktop: 70% */}
        <div className="w-full sm:w-[70%] px-2 sm:px-4">
          <div className="relative w-full bg-white/10 rounded-xl py-2 overflow-x-auto sm:overflow-hidden">
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
                  className="inline-flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-sm px-3 sm:px-6 py-2 rounded-lg hover:bg-white/20 transition-all duration-300 min-w-[180px]"
                >
                  <span className="text-sm sm:text-base font-semibold truncate max-w-[120px] sm:max-w-none">{fish.name}</span>
                  <span className="text-base sm:text-lg font-bold text-yellow-300">₹{fish.rate}</span>
                  <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap bg-green-200 text-green-800">
                    In Stock
                  </span>
                </div>
              ))}
            </div>

            {/* Fading edges for visual polish */}
            {shouldAnimate && (
              <>
                <div className="absolute left-0 top-0 w-10 sm:w-20 h-full bg-gradient-to-r from-purple-500 to-transparent pointer-events-none"></div>
                <div className="absolute right-0 top-0 w-10 sm:w-20 h-full bg-gradient-to-l from-pink-500 to-transparent pointer-events-none"></div>
              </>
            )}
          </div>
        </div>

        {/* Column 3: Live Status - Mobile: Full width, Desktop: 15% */}
        <div className="w-full sm:w-[15%] flex flex-col items-center sm:items-end justify-center text-sm text-purple-100">
          <span className="flex items-center gap-1">
            ⭐ Live {new Date().toLocaleTimeString()}
          </span>
          <span className="text-xs text-purple-200">Auto-updating</span>
        </div>
      </div>

      {/* Footer - Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-purple-100 mt-3 sm:mt-2 gap-2 sm:gap-0">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span> Live Stock
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-sky-400 rounded-full"></span> Fresh Daily
        </span>
      </div>
    </div>
  );
};

export default SmartBanner;
