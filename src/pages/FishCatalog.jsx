import { useState, useMemo, useEffect } from 'react';
import EnhancedFishCard from '../components/EnhancedFishCard';
import SpecialOffersSection from '../components/SpecialOffersSection';

const FishCatalog = ({
  fishData,
  addToCart,
  onBuyNow,
  toggleFavorite,
  favorites,
  cart,
  voiceSearchQuery,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });

  const categories = ['All', 'Seawater', 'Freshwater'];

  useEffect(() => {
    if (typeof voiceSearchQuery === 'string') {
      const trimmedQuery = voiceSearchQuery.trim();
      if (trimmedQuery && trimmedQuery !== searchTerm) {
        setSearchTerm(trimmedQuery);
        setSelectedCategory('All');
      }
    }
  }, [voiceSearchQuery, searchTerm]);

  const filteredFishes = useMemo(() => {
    let filtered = fishData.fishes.filter(fish => {
      const matchesSearch = fish.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || fish.category === selectedCategory;
      // Never show out-of-stock items on the public catalog
      const matchesStock = fish.inStock !== false && fish.available !== false;
      const matchesPriceRange = fish.rate >= priceRange.min && fish.rate <= priceRange.max;
      
      return matchesSearch && matchesCategory && matchesStock && matchesPriceRange;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rate':
          comparison = a.rate - b.rate;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [fishData.fishes, searchTerm, selectedCategory, sortBy, sortOrder, priceRange]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-cyan-50 to-white pb-mobile-nav md:pb-8">
      <SpecialOffersSection
        fishData={fishData}
        shopNowHref="#fish-catalog-list"
        compact
      />
      {/* Main Content with Sidebar Layout — fish list first */}
        <div id="fish-catalog-list" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-3 sm:pt-3 sm:pb-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 relative z-20">
          
          {/* Sidebar Filters - Desktop Only */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">🔍 Search & Filter</h3>
              
              <div className="space-y-6">
            {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Fish</label>
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search fish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-12 px-4 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all duration-300"
                    />
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all duration-300"
                  >
                    <option value="All">All Categories</option>
                    {categories.filter(cat => cat !== 'All').map(category => (
                      <option key={category} value={category}>{category} Fish</option>
                    ))}
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all duration-300"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="rate">Sort by Price</option>
                    <option value="category">Sort by Category</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all duration-300"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>

                {/* Price Range Slider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">💰 Price Range (₹)</label>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                      <span>₹{priceRange.min}</span>
                      <span>₹{priceRange.max}</span>
                    </div>
                    
                    {/* Dual Range Slider Container */}
                    <div className="relative h-8 flex items-center">
                      {/* Background Track */}
                      <div className="absolute w-full h-2 bg-gray-200 rounded-lg"></div>
                      
                      {/* Active Range Track */}
                      <div 
                        className="absolute h-2 bg-blue-500 rounded-lg"
                        style={{
                          left: `${(priceRange.min / 10000) * 100}%`,
                          width: `${((priceRange.max - priceRange.min) / 10000) * 100}%`
                        }}
                      ></div>
                      
                      {/* Min Range Input */}
                      <input
                        type="range"
                        min="0"
                        max="10000"
                        value={priceRange.min}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value);
                          if (newMin < priceRange.max) {
                            setPriceRange({...priceRange, min: newMin});
                          }
                        }}
                        className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer z-10"
                        style={{ zIndex: priceRange.min > priceRange.max - 200 ? 5 : 10 }}
                      />
                      
                      {/* Max Range Input */}
                      <input
                        type="range"
                        min="0"
                        max="10000"
                        value={priceRange.max}
                        onChange={(e) => {
                          const newMax = parseInt(e.target.value);
                          if (newMax > priceRange.min) {
                            setPriceRange({...priceRange, max: newMax});
                          }
                        }}
                        className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer z-10"
                        style={{ zIndex: priceRange.max < priceRange.min + 200 ? 5 : 10 }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-center gap-3 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                      <span>Min: ₹{priceRange.min}</span>
                      <span>•</span>
                      <span>Max: ₹{priceRange.max}</span>
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('All');
                    setSortBy('name');
                    setSortOrder('asc');
                    setPriceRange({ min: 0, max: 10000 });
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 h-12 rounded-xl text-gray-700 transition-all duration-300 font-medium"
                >
                  🗑️ Clear All Filters
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Filters - compact sticky bar */}
          <div className="lg:hidden mb-4 sticky top-[3.5rem] z-30 -mx-1">
            <div className="flex flex-col gap-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-gray-100 px-3 py-3">
              <div className="relative w-full">
                <input
                  type="search"
                  enterKeyHint="search"
                  placeholder="Search fish..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-12 px-4 pl-11 border border-gray-200 rounded-xl w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-base"
                />
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-11 px-3 border border-gray-200 rounded-xl w-full focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="All">All Categories</option>
                  {categories.filter((cat) => cat !== 'All').map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [nextSort, nextOrder] = e.target.value.split('-');
                    setSortBy(nextSort);
                    setSortOrder(nextOrder);
                  }}
                  className="h-11 px-3 border border-gray-200 rounded-xl w-full focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="rate-asc">Price Low–High</option>
                  <option value="rate-desc">Price High–Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fish Grid - Main Content */}
          <div className="flex-1 min-w-0">
          {filteredFishes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">🐟</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No fish found</h3>
              <p className="text-gray-600 mb-5 text-sm">Try adjusting your search or filters</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                  setSortBy('name');
                  setSortOrder('asc');
                  setPriceRange({ min: 0, max: 10000 });
                }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 px-0.5">
                <h2 className="text-sm sm:text-base font-bold text-gray-800 truncate">
                  🐟 Fresh Catch
                  <span className="font-medium text-gray-500"> · {filteredFishes.length} available</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 px-0 sm:px-2">
                {filteredFishes.map((fish) => (
                  <EnhancedFishCard
                    key={fish.id}
                    fish={fish}
                    shopInfo={fishData.shopInfo}
                    onToggleFavorite={toggleFavorite}
                    isFavorite={favorites.includes(fish.id)}
                    fishData={fishData}
                    addToCart={addToCart}
                    onBuyNow={onBuyNow}
                    cart={cart}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .fish-card {
            break-inside: avoid;
            margin-bottom: 1rem;
          }
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 4px;
          outline: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default FishCatalog;

