import { useState } from 'react';
import { X, ShoppingCart, Star, Heart, Share2 } from 'lucide-react';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import QuantityInput from './QuantityInput';
import { QUANTITY_LIMITS, normalizeQuantity } from '../utils/quantityUtils';
import { normalizeDeliveryChargeRupees } from '../utils/moneyUtils';

const QuickViewModal = ({ fish, isOpen, onClose, addToCart, onBuyNow, cart, onToggleFavorite, isFavorite, deliveryCharge = 0 }) => {
  const [quantity, setQuantity] = useState(QUANTITY_LIMITS.MIN);
  const [isQuantityValid, setIsQuantityValid] = useState(true);

  if (!isOpen || !fish) return null;

  const showFreeDelivery = normalizeDeliveryChargeRupees(deliveryCharge) === 0;

  const handleAddToCart = () => {
    if (!isQuantityValid) {
      return;
    }

    const normalizedQuantity = normalizeQuantity(quantity);
    addToCart(fish, normalizedQuantity);
    setQuantity(QUANTITY_LIMITS.MIN);
  };

  const handleBuyNow = () => {
    if (!isQuantityValid) {
      return;
    }

    if (onBuyNow) {
      onBuyNow(fish, normalizeQuantity(quantity));
      onClose(); // Close the modal
    }
  };

  const cartItem = cart.find(item => item.id === fish.id);
  const isInCart = !!cartItem;

  const handleToggleFavorite = () => {
    onToggleFavorite(fish.id);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${fish.name} - Fresh Fish`,
          text: `Check out this fresh ${fish.name} at ₹${fish.rate}/${fish.unit}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Product Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Section */}
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={getFishImageUrl(fish.image)}
                  alt={fish.name}
                  className="w-full h-80 object-cover rounded-xl"
                  onError={handleImageError}
                />
                
                {/* Stock Badge */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-medium ${
                  fish.inStock 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {fish.inStock ? '🟢 In Stock' : '🔴 Out of Stock'}
                </div>

                {/* Action Buttons */}
                <div className="absolute top-4 left-4 flex space-x-2">
                  <button
                    onClick={handleToggleFavorite}
                    className={`p-2 rounded-full transition-all duration-300 ${
                      isFavorite 
                        ? 'bg-red-500 text-white' 
                        : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2 bg-white text-gray-600 rounded-full hover:bg-blue-600 hover:text-white transition-all duration-300"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Product Info Section */}
            <div className="space-y-6">
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">{fish.name}</h3>
                <p className="text-lg text-gray-600 capitalize mb-4">{fish.category} Fish</p>
                
                {/* Rating */}
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-current" />
                    ))}
                  </div>
                  <span className="text-lg text-gray-600 ml-3">(4.8)</span>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-blue-600">₹{fish.rate}</span>
                  <span className="text-xl text-gray-600 ml-2">/{fish.unit}</span>
                  {isInCart && (
                    <div className="mt-2 text-lg text-green-600 font-medium">
                      In Cart ({normalizeQuantity(cartItem.quantity).toFixed(1)} kg)
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {fish.description && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-600 leading-relaxed">{fish.description}</p>
                </div>
              )}

              {/* Quantity Selection */}
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-gray-900">Quantity</h4>
                <QuantityInput
                  value={quantity}
                  onChange={setQuantity}
                  onValidityChange={setIsQuantityValid}
                  rate={fish.rate}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleAddToCart}
                  disabled={!fish.inStock || !isQuantityValid}
                  className={`flex-1 flex items-center justify-center space-x-3 py-4 px-6 rounded-xl font-medium transition-all duration-300 ${
                    fish.inStock
                      ? 'bg-blue-500 text-white hover:bg-opacity-90 hover:scale-105 shadow-lg hover:shadow-xl disabled:bg-blue-300 disabled:hover:scale-100 disabled:cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="w-6 h-6" />
                  <span className="text-lg">{isInCart ? 'Add More' : 'Add to Cart'}</span>
                </button>
                {onBuyNow && (
                  <button
                    onClick={handleBuyNow}
                    disabled={!fish.inStock || !isQuantityValid}
                    className={`px-6 py-4 rounded-xl font-medium transition-all duration-300 ${
                      fish.inStock
                        ? 'bg-red-500 text-white hover:bg-opacity-90 hover:scale-105 shadow-lg hover:shadow-xl disabled:bg-red-300 disabled:hover:scale-100 disabled:cursor-not-allowed'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-lg">{fish.inStock ? 'Buy Now' : 'Out of Stock'}</span>
                  </button>
                )}
              </div>

              {/* Product Features */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600">✓</span>
                  </div>
                  <span className="text-sm text-gray-600">Fresh Daily</span>
                </div>
                {showFreeDelivery && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600">🚚</span>
                    </div>
                    <span className="text-sm text-gray-600">FREE DELIVERY*</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600">🔒</span>
                  </div>
                  <span className="text-sm text-gray-600">Secure Payment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600">⭐</span>
                  </div>
                  <span className="text-sm text-gray-600">Premium Quality</span>
                </div>
              </div>
              {showFreeDelivery && (
                <p className="text-[11px] text-gray-500 pt-1">*Conditions apply</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;
