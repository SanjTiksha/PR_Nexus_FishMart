import { useState } from 'react';
import { Heart, Share2, Star, Eye, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { getDisplayPrice, formatPrice } from '../utils/pricing';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import QRModal from './QRModal';
import QuickViewModal from './QuickViewModal';
import QuantityInput from './QuantityInput';
import { QUANTITY_LIMITS, normalizeQuantity } from '../utils/quantityUtils';
import { normalizeDeliveryChargeRupees } from '../utils/moneyUtils';
import {
  getBestOfferForProduct,
  formatOfferDiscountLabel,
  estimateProductOfferPrice,
} from '../utils/offerUtils';

const EnhancedFishCard = ({
  fish,
  shopInfo,
  onToggleFavorite,
  isFavorite = false,
  addToCart,
  onBuyNow,
  cart,
  fishData,
}) => {
  const [showQR, setShowQR] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [quantity, setQuantity] = useState(QUANTITY_LIMITS.MIN);
  const [isQuantityValid, setIsQuantityValid] = useState(true);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const fishInfo = (fish.Fish_description || fish.description || '').trim();

  const handleBuyNowClick = () => {
    if (!isQuantityValid) {
      return;
    }

    const normalizedQuantity = normalizeQuantity(quantity);

    if (onBuyNow) {
      onBuyNow(fish, normalizedQuantity);
    } else {
      // Fallback to QR modal if onBuyNow not provided
      setShowQR(true);
    }
  };

  const handleAddToCart = () => {
    if (!isQuantityValid) {
      return;
    }

    const normalizedQuantity = normalizeQuantity(quantity);

    addToCart(fish, normalizedQuantity);
    setQuantity(QUANTITY_LIMITS.MIN);
  };

  const cartItem = cart.find(item => item.id === fish.id);
  const isInCart = !!cartItem;
  
  // Get promotional pricing (legacy banner promo) + active offer badge
  const priceInfo = getDisplayPrice(fish, fishData?.promotions);
  const productOffer = getBestOfferForProduct(fish, fishData?.offers || []);
  const offerBadge = productOffer ? formatOfferDiscountLabel(productOffer) : null;
  const offerDisplayPrice = productOffer
    ? estimateProductOfferPrice(fish, productOffer)
    : null;

  const handleToggleFavorite = () => {
    onToggleFavorite(fish.id);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${fish.name} - ${shopInfo.name}`,
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

  return (
    <>
      <div className="relative bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100">
        <div className="relative">
          <div className="relative h-36 sm:h-40 md:h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
              </div>
            )}
            <img
              src={getFishImageUrl(fish.image)}
              alt={fish.name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                handleImageError(e);
                setImageLoaded(true);
              }}
            />

            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 items-center justify-center hidden sm:flex">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex space-x-3">
                <button
                  onClick={() => setShowQuickView(true)}
                  className="bg-white text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium"
                >
                  <Eye className="w-4 h-4 inline mr-1" />
                  Quick View
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={!fish.inStock || !isQuantityValid}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  <ShoppingCart className="w-4 h-4 inline mr-1" />
                  Add
                </button>
              </div>
            </div>

            <button
              onClick={handleShare}
              className="absolute top-1.5 left-1.5 bg-white/90 p-2 rounded-full shadow-sm min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Share"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-700" />
            </button>

            <button
              onClick={handleToggleFavorite}
              className="absolute top-1.5 right-1.5 bg-white p-2 rounded-full shadow-sm min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Favorite"
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-red-500' : 'text-gray-600'}`} />
            </button>

            <div className={`absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm border ${
              fish.inStock
                ? 'bg-white/90 text-green-700 border-green-200'
                : 'bg-white/90 text-red-700 border-red-200'
            }`}>
              {fish.inStock ? 'In Stock' : 'Out of Stock'}
            </div>
          </div>
        </div>

        <div className="p-2.5 sm:p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-tight truncate">
                {fish.name}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                <span className="truncate">{fish.category}</span>
                <span className="text-yellow-400 inline-flex items-center">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-gray-500 ml-0.5">4.8</span>
                </span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {offerDisplayPrice != null && offerBadge ? (
                <>
                  <div className="text-[11px] text-gray-400 line-through leading-none mb-0.5">
                    ₹{formatPrice(fish.rate)}
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-blue-600 leading-none">
                    ₹{formatPrice(offerDisplayPrice)}
                    <span className="text-[11px] font-medium text-gray-500">/kg</span>
                  </div>
                  <span className="inline-block mt-1 text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-semibold">
                    {offerBadge}
                  </span>
                </>
              ) : (
                <>
                  <div className="text-lg sm:text-xl font-bold text-blue-600 leading-none">
                    ₹{formatPrice(priceInfo.catalogPrice)}
                    <span className="text-[11px] font-medium text-gray-500">/kg</span>
                  </div>
                  {/* Legacy banner badge only — does not change cart unit price */}
                  {priceInfo.isDiscounted && (
                    <span className="inline-block mt-0.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">
                      {priceInfo.discountPercentage}% OFF
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            onValidityChange={setIsQuantityValid}
            rate={priceInfo.catalogPrice}
            variant="card"
          />

          <div className="flex items-stretch gap-1.5">
            <button
              onClick={handleAddToCart}
              disabled={!fish.inStock || !isQuantityValid}
              className={`flex-1 min-h-[42px] py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                fish.inStock
                  ? 'bg-blue-600 text-white active:bg-blue-800 disabled:bg-blue-300 disabled:cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Add to Cart
            </button>
            <button
              onClick={handleBuyNowClick}
              disabled={!fish.inStock || !isQuantityValid}
              className={`flex-1 min-h-[42px] py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                fish.inStock
                  ? 'bg-orange-500 text-white active:bg-orange-700 disabled:bg-orange-300 disabled:cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {fish.inStock ? 'Buy Now' : 'Out of Stock'}
            </button>
          </div>

          {fishInfo && (
            <button
              type="button"
              onClick={() => setInfoExpanded((open) => !open)}
              className="w-full text-left rounded-lg bg-gray-50 px-2 py-1.5 border border-gray-100 active:bg-gray-100"
              aria-expanded={infoExpanded}
            >
              <div className="flex items-start gap-1.5">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-cyan-700 bg-cyan-50 border border-cyan-100 px-1.5 py-0.5 rounded">
                  Info
                </span>
                <p
                  className={`flex-1 min-w-0 text-[11px] sm:text-xs text-gray-600 leading-snug ${
                    infoExpanded ? '' : 'truncate'
                  }`}
                >
                  {fishInfo}
                </p>
                <span className="shrink-0 text-gray-400 mt-0.5">
                  {infoExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </div>
            </button>
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

      {showQuickView && (
        <QuickViewModal
          fish={fish}
          isOpen={showQuickView}
          onClose={() => setShowQuickView(false)}
          addToCart={addToCart}
          onBuyNow={onBuyNow}
          cart={cart}
          onToggleFavorite={onToggleFavorite}
          isFavorite={isFavorite}
          deliveryCharge={normalizeDeliveryChargeRupees(
            shopInfo?.deliveryCharge ?? fishData?.shopInfo?.deliveryCharge,
          )}
        />
      )}
    </>
  );
};

export default EnhancedFishCard;
