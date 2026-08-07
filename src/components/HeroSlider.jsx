import React, { useState } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const HeroSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      src: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      caption: "Fresh Surmai Every Morning",
      description: "Premium King Fish - Direct from the Sea"
    },
    {
      src: "https://images.unsplash.com/photo-1559737558-9d8c3c6e8e4f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      caption: "Premium Pomfret from the Sea",
      description: "White Pomfret - Cleaned & Ready to Cook"
    },
    {
      src: "https://images.unsplash.com/photo-1559847844-5315695dadae?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      caption: "Crabs & Prawns at Wholesale Prices",
      description: "Fresh Seafood - Best Quality Guaranteed"
    },
    {
      src: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      caption: "Cleaned, Packed, Ready for You",
      description: "Professional Processing - Zero Waste"
    },
    {
      src: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      caption: "Daily Fresh Catch",
      description: "From Ocean to Your Table - Same Day Delivery"
    }
  ];

  const settings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    pauseOnHover: true,
    fade: true,
    arrows: true,
    beforeChange: (oldIndex, newIndex) => setCurrentSlide(newIndex),
    customPaging: (i) => (
      <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
        i === currentSlide ? 'bg-white' : 'bg-white/50'
      }`} />
    ),
    appendDots: (dots) => (
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <ul className="flex space-x-2">{dots}</ul>
      </div>
    ),
    prevArrow: (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 cursor-pointer bg-black/30 hover:bg-black/50 rounded-full p-3 transition-all duration-300 hidden sm:block">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </div>
    ),
    nextArrow: (
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 cursor-pointer bg-black/30 hover:bg-black/50 rounded-full p-3 transition-all duration-300 hidden sm:block">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    )
  };

  return (
    <div className="relative w-full h-[70vh] sm:h-[65vh] md:h-[75vh] overflow-hidden rounded-2xl shadow-2xl mt-0 pt-0">
      <Slider {...settings}>
        {slides.map((slide, index) => (
          <div key={index} className="relative w-full h-[70vh] sm:h-[65vh] md:h-[75vh]">
            <img
              src={slide.src}
              alt={slide.caption}
              className="w-full h-full object-cover"
              loading={index === 0 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            {/* Slide-specific content */}
            <div className="absolute inset-0 flex flex-col justify-end pb-16 px-8">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg animate-fade-in-up">
                  {slide.caption}
                </h2>
                <p className="text-white/90 text-lg sm:text-xl md:text-2xl drop-shadow-md animate-fade-in-up animation-delay-200">
                  {slide.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </Slider>
      
      {/* Main heading overlay */}
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-20">
        <div className="text-center">
          <h1 className="text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 drop-shadow-2xl animate-fade-in-up">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-600 bg-clip-text text-transparent">
              Fresh Fish
            </span>
            <br />
            <span className="text-white">Every Morning</span>
            <span className="ml-4 text-3xl sm:text-4xl md:text-5xl">🐟</span>
          </h1>
          <p className="text-white/90 text-lg sm:text-xl md:text-2xl mb-8 max-w-4xl mx-auto drop-shadow-lg animate-fade-in-up animation-delay-300">
            Direct from the sea to your table. Premium quality fish at wholesale prices with guaranteed freshness.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center animate-fade-in-up animation-delay-400">
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
        </div>
      </div>
    </div>
  );
};

export default HeroSlider;
