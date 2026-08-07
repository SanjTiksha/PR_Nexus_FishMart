import React, { useState, useEffect } from "react";

const HeroSliderSimple = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // 11 local banner images from /images/ folder
  const slides = [
    {
      src: "/images/banner_1.png",
      caption: "Fresh Surmai Every Morning",
      description: "Premium King Fish - Direct from the Sea"
    },
    {
      src: "/images/banner_2.png",
      caption: "Premium Pomfret from the Sea",
      description: "White Pomfret - Cleaned & Ready to Cook"
    },
    {
      src: "/images/banner_3.png",
      caption: "Crabs & Prawns at Wholesale Prices",
      description: "Fresh Seafood - Best Quality Guaranteed"
    },
    {
      src: "/images/banner_4.png",
      caption: "Cleaned, Packed, Ready for You",
      description: "Professional Processing - Zero Waste"
    },
    {
      src: "/images/banner_5.png",
      caption: "Daily Fresh Catch",
      description: "From Ocean to Your Table - Same Day Delivery"
    },
    {
      src: "/images/banner_6.png",
      caption: "Premium Quality Seafood",
      description: "Best Prices Guaranteed"
    },
    {
      src: "/images/banner_7.png",
      caption: "Fresh Fish Every Day",
      description: "Direct from the Ocean"
    },
    {
      src: "/images/banner_8.png",
      caption: "Quality You Can Trust",
      description: "Fresh & Delicious"
    },
    {
      src: "/images/banner_9.png",
      caption: "Wholesale Prices",
      description: "Retail Quality"
    },
    {
      src: "/images/banner_10.png",
      caption: "Same Day Delivery",
      description: "Fast & Reliable"
    },
    {
      src: "/images/banner_11.png",
      caption: "PR Nexus FishMart",
      description: "Your Trusted Seafood Partner"
    }
  ];

  // Auto-slide functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="relative w-full h-[56vh] sm:h-[52vh] md:h-[60vh] overflow-hidden rounded-3xl shadow-2xl mt-0 pt-0 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-600">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent animate-pulse"></div>
      </div>

      {/* Main slider container */}
      <div className="relative w-full h-full rounded-3xl overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === currentSlide 
                ? 'opacity-100 scale-100' 
                : 'opacity-0 scale-105'
            }`}
          >
            <img
              src={slide.src}
              alt={slide.caption}
              className="w-full h-full object-cover transform transition-transform duration-1000 hover:scale-105"
              loading={index === 0 ? "eager" : "lazy"}
              onError={(e) => {
                console.log('Image failed to load:', slide.src);
                e.target.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
            
            {/* Slide-specific content */}
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <h3 className="text-2xl md:text-3xl font-bold mb-2 animate-fade-in-up">{slide.caption}</h3>
              <p className="text-lg md:text-xl text-white/90 animate-fade-in-up animation-delay-200">{slide.description}</p>
            </div>
          </div>
        ))}
        
        {/* Main heading overlay - Always visible */}
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white drop-shadow-2xl leading-tight mb-4 md:mb-6">
              <span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-400 bg-clip-text text-transparent animate-pulse">
                Fresh Fish
              </span>{" "}
              <span className="text-white">Every Morning</span>
              <span className="text-4xl sm:text-5xl md:text-7xl ml-2 animate-bounce">🐟</span>
            </h1>
          </div>

          <div className="animate-fade-in-up animation-delay-200">
            <p className="text-base sm:text-lg md:text-xl text-white/95 max-w-3xl mb-8 md:mb-10 leading-relaxed font-medium">
              Direct from the sea to your table. Premium quality fish at wholesale prices
              with guaranteed freshness and same-day delivery.
            </p>
          </div>

          <div className="animate-fade-in-up animation-delay-300 flex flex-col sm:flex-row gap-3 justify-center items-center mt-2 sm:mt-0">
            <a
              href="/fish"
              className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold text-sm sm:text-base shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
            >
              <span>View Today's Rates</span>
              <span className="ml-2 text-base group-hover:translate-x-1 transition-transform duration-300">→</span>
            </a>
            
            <a
              href="https://wa.me/919096205136"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-sm sm:text-base shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <span className="text-base">💬</span>
              <span>WhatsApp Now</span>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="animate-fade-in-up animation-delay-400 mt-8 flex flex-wrap justify-center gap-6 text-white/80">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✓</span>
              <span className="text-sm font-medium">Fresh Daily</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✓</span>
              <span className="text-sm font-medium">Best Prices</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✓</span>
              <span className="text-sm font-medium">Fast Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 cursor-pointer bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full p-4 transition-all duration-300 hidden sm:block group"
      >
        <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 cursor-pointer bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full p-4 transition-all duration-300 hidden sm:block group"
      >
        <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'bg-white scale-125 shadow-lg' 
                  : 'bg-white/60 hover:bg-white/80 hover:scale-110'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSliderSimple;
