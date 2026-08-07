import { useState } from 'react';
import QRModal from './QRModal';
import { ShoppingCart, Share2 } from 'lucide-react';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import QuantityInput from './QuantityInput';
import { QUANTITY_LIMITS, normalizeQuantity, calculateLineTotal } from '../utils/quantityUtils';

const FishCard = ({ fish, shopInfo, addToCart, cart }) => {
  const [showQR, setShowQR] = useState(false);
  const [quantity, setQuantity] = useState(QUANTITY_LIMITS.MIN);
  const [isQuantityValid, setIsQuantityValid] = useState(true);

  const handleBuyNow = () => {
    setShowQR(true);
  };

  const handleAddToCart = () => {
    if (!isQuantityValid) {
      return;
    }

    const normalizedQuantity = normalizeQuantity(quantity);
    addToCart(fish, normalizedQuantity);
    setQuantity(QUANTITY_LIMITS.MIN);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${fish.name} - ${shopInfo?.name || 'PR Nexus FishMart'}`,
          text: `Check out this fresh ${fish.name} at ₹${fish.rate}/${fish.unit}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const cartItem = cart.find(item => item.id === fish.id);
  const isInCart = !!cartItem;

  return (
    <>
      <div className="group bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden border border-gray-100">
        {/* Image Container with Enhanced Effects */}
        <div className="relative overflow-hidden">
          <img
            src={getFishImageUrl(fish.image)}
            alt={fish.name}
            className="w-full h-56 object-cover transition-transform duration-700 group-hover:scale-110"
            onError={handleImageError}
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          {/* Share Button - moved to top-left */}
          <button
            onClick={handleShare}
            className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition-all duration-300 transform hover:scale-110"
          >
            <Share2 className="w-4 h-4 text-gray-700" />
          </button>

          {/* Stock Status Badge - bottom-right, larger premium size to cover watermark */}
          <div className={`absolute bottom-3 right-3 text-base font-bold px-4 py-2 rounded-xl shadow-md border transition-all duration-300 ${
            fish.inStock 
              ? 'bg-white/70 backdrop-blur-sm text-green-800 border-green-300' 
              : 'bg-white/70 backdrop-blur-sm text-red-800 border-red-300'
          }`}>
            {fish.inStock ? '✅ In Stock' : '❌ Out of Stock'}
          </div>

          {/* Quick Actions Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <div className="flex space-x-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              <button className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-medium hover:bg-white/30 transition-all duration-300">
                Quick View
              </button>
              <button
                onClick={handleAddToCart}
                disabled={!fish.inStock || !isQuantityValid}
                className="bg-blue-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700/90 transition-all duration-300 disabled:opacity-60 disabled:hover:bg-blue-600/90 disabled:cursor-not-allowed"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6 space-y-4">
          {/* Fish Info */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
              {fish.name}
            </h3>
            <p className="text-sm text-gray-600 capitalize font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full inline-block">
              {fish.category} Fish
            </p>
          </div>

          {/* Price Section */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  ₹{fish.rate}
                </span>
                <span className="text-gray-600 font-medium">/{fish.unit}</span>
              </div>
              {isInCart && (
                <div className="text-sm text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">
                  ✓ In Cart ({normalizeQuantity(cartItem.quantity).toFixed(1)} kg)
                </div>
              )}
            </div>
            
            {/* Rating Stars */}
            <div className="flex items-center space-x-1">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-sm">⭐</span>
                ))}
              </div>
              <span className="text-sm text-gray-500 font-medium">(4.8)</span>
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <QuantityInput
              value={quantity}
              onChange={setQuantity}
              onValidityChange={setIsQuantityValid}
              rate={fish.rate}
              variant="compact"
            />
            <div className="text-center text-sm text-gray-600">
              ₹{calculateLineTotal(fish.rate, quantity).toFixed(2)} for{' '}
              {normalizeQuantity(quantity).toFixed(1)} kg
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!fish.inStock || !isQuantityValid}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 ${
                fish.inStock
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-blue-500/25 disabled:bg-blue-400 disabled:hover:scale-100 disabled:cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span>{isInCart ? 'Add More' : 'Add to Cart'}</span>
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!fish.inStock || !isQuantityValid}
              className={`py-3 px-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 ${
                fish.inStock
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-red-500/25 disabled:bg-red-300 disabled:hover:scale-100 disabled:cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {fish.inStock ? 'Buy Now' : 'Out of Stock'}
            </button>
          </div>

          {/* Description */}
          {fish.description && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-sm text-gray-700 leading-relaxed">{fish.description}</p>
            </div>
          )}
        </div>
      </div>

      {showQR && (
        <QRModal
          fish={fish}
          shopInfo={shopInfo}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
};

export default FishCard;

