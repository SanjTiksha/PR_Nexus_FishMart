import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, ShoppingBag, Trash2, ChevronDown } from 'lucide-react';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import QuantityInput from './QuantityInput';
import { calculateLineTotal, normalizeQuantity } from '../utils/quantityUtils';
import {
  calculateCartSummary,
  DEFAULT_DISCOUNT_SETTINGS,
} from '../utils/cartPricing';
import { normalizeDeliveryChargeRupees } from '../utils/moneyUtils';

const ShoppingCart = ({ isOpen, onClose, cart, onUpdateCart, onRemoveItem, onClearCart, onCheckout, fishData }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [invalidItems, setInvalidItems] = useState({});
  const [hiddenBelowCount, setHiddenBelowCount] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the modal is rendered before animation
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setInvalidItems({});
  }, [cart]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  const updateHiddenBelowCount = useCallback(() => {
    const container = listRef.current;
    if (!container || cart.length <= 1) {
      setHiddenBelowCount(0);
      return;
    }

    const containerBottom = container.getBoundingClientRect().bottom;
    const itemNodes = container.querySelectorAll('[data-cart-item]');
    let hidden = 0;
    itemNodes.forEach((node) => {
      if (node.getBoundingClientRect().top >= containerBottom - 2) {
        hidden += 1;
      }
    });
    setHiddenBelowCount(hidden);
  }, [cart.length]);

  useEffect(() => {
    if (!isOpen) {
      setHiddenBelowCount(0);
      return undefined;
    }

    const frame = requestAnimationFrame(updateHiddenBelowCount);
    const timer = setTimeout(updateHiddenBelowCount, 320);
    window.addEventListener('resize', updateHiddenBelowCount);

    const container = listRef.current;
    const observer =
      container && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateHiddenBelowCount)
        : null;
    if (container && observer) observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('resize', updateHiddenBelowCount);
      observer?.disconnect();
    };
  }, [isOpen, cart, isAnimating, updateHiddenBelowCount]);

  const cartSummary = useMemo(() => {
    const discountSettings = fishData?.discountSettings || DEFAULT_DISCOUNT_SETTINGS;
    const deliveryCharge = normalizeDeliveryChargeRupees(fishData?.shopInfo?.deliveryCharge);
    return calculateCartSummary(
      cart,
      discountSettings,
      fishData?.offers || [],
      new Date(),
      deliveryCharge,
    );
  }, [cart, fishData?.discountSettings, fishData?.offers, fishData?.shopInfo?.deliveryCharge]);

  const subtotal = cartSummary.subtotal;
  const discount = cartSummary.discount;
  const totalPrice = cartSummary.total;
  const appliedOffer = cartSummary.appliedOffer;

  const totalItems = useMemo(() => {
    return cart.reduce((total, item) => total + normalizeQuantity(item.quantity), 0);
  }, [cart]);

  const hasInvalidQuantities = useMemo(
    () => Object.values(invalidItems).some((value) => value === true),
    [invalidItems],
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden overscroll-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-[33.6rem] h-[94vh] max-h-[94vh] sm:h-auto flex flex-col overflow-hidden transform transition-all duration-300 pb-safe ${
          isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center space-x-2 min-w-0 flex-wrap">
            <ShoppingBag className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h2 className="text-xl font-bold text-gray-900">
              Shopping Cart
              {cart.length > 0 && (
                <span className="font-semibold text-gray-600">
                  {` • ${cart.length} ${cart.length === 1 ? 'item' : 'items'}`}
                </span>
              )}
            </h2>
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {totalItems.toFixed(1)} kg
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {/* Clear Cart Button - Only show if cart has items */}
            {cart.length > 0 && onClearCart && (
              <button
                onClick={onClearCart}
                className="p-2 hover:bg-red-50 rounded-full transition-colors group"
                title="Clear Cart"
              >
                <Trash2 className="w-5 h-5 text-red-500 group-hover:text-red-700" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4"
          onScroll={updateHiddenBelowCount}
        >
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Your cart is empty</h3>
              <p className="text-gray-500">Add some fresh fish to get started!</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                data-cart-item
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                <img
                  src={getFishImageUrl(item.image)}
                  alt={item.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0"
                  onError={handleImageError}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    ₹{item.price || item.rate}/{item.unit || 'kg'}
                  </p>
                  <p className="font-semibold text-blue-600 sm:hidden">
                    ₹{calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}
                  </p>
                </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:contents">
                <div className="w-[140px] sm:w-[140px]">
                  <QuantityInput
                    value={item.quantity}
                    onChange={(updatedQuantity) => onUpdateCart(item.id, updatedQuantity)}
                    onValidityChange={(isValid) =>
                      setInvalidItems((prev) => ({ ...prev, [item.id]: !isValid }))
                    }
                    rate={item.price || item.rate}
                    variant="compact"
                  />
                </div>
                <div className="text-right hidden sm:block">
                  <p className="font-medium text-blue-600">
                    ₹{calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="sm:hidden text-red-500 text-sm font-medium px-2 py-2"
                >
                  Remove
                </button>
                </div>
              </div>
            ))
          )}
        </div>
          {hiddenBelowCount > 0 && (
            <div className="pointer-events-none flex-shrink-0 border-t border-cyan-200 bg-white px-4 py-2">
              <div className="flex items-center justify-center gap-2 rounded-xl border border-[#087EA4] bg-[#087EA4] px-3 py-2 shadow-sm">
                <ChevronDown className="w-5 h-5 text-white flex-shrink-0" aria-hidden="true" />
                <p className="text-sm font-bold text-white leading-tight">
                  {`+${hiddenBelowCount} more ${hiddenBelowCount === 1 ? 'item' : 'items'} • Scroll to view more`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-4 flex-shrink-0 bg-white">
            {/* Price Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              
              {discount > 0 && appliedOffer && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Offer Discount:</span>
                    <span className="font-medium">-₹{discount.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1.5">
                    Best Offer Applied: {appliedOffer.title}
                  </p>
                </>
              )}

              {discount > 0 && !appliedOffer && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({fishData?.discountSettings?.percentage || 5}% {fishData?.discountSettings?.description || "off ₹1000+"}):</span>
                  <span className="font-medium">-₹{discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery:</span>
                <span className="font-medium">₹{Number(cartSummary.deliveryCharge || 0).toFixed(2)}</span>
              </div>
              
              <hr className="border-gray-200" />
              
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total:</span>
                <span className="text-2xl font-bold text-blue-600">₹{totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-3">
              {/* Clear Cart Button - Bottom */}
              {onClearCart && (
                <button
                  onClick={onClearCart}
                  className="w-full py-2.5 px-4 border-2 border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 hover:border-red-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Cart
                </button>
              )}
              
              {hasInvalidQuantities && (
                <p className="text-xs text-red-500 text-center">
                  Update failed — please re-check quantity or try again.
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:space-x-3 sm:gap-0">
                <button
                  onClick={onClose}
                  className="flex-1 min-h-[48px] py-3 px-4 border border-gray-300 rounded-xl font-medium active:bg-gray-100"
                >
                  Continue Shopping
                </button>
                <button 
                  onClick={() => {
                    if (onCheckout && !hasInvalidQuantities) {
                      onCheckout(cart, totalPrice);
                    }
                  }}
                  disabled={hasInvalidQuantities}
                  className="flex-1 min-h-[48px] py-3 px-4 bg-red-500 text-white rounded-xl font-semibold active:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                >
                  Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShoppingCart;
