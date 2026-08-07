import { useState, useEffect } from 'react';
import { X, ShoppingBag, CreditCard, ArrowRight, MapPin, Phone, User } from 'lucide-react';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import { normalizeQuantity, calculateLineTotal } from '../utils/quantityUtils';
import DeliveryLocationPicker from './DeliveryLocationPicker';

const CheckoutConfirmation = ({ isOpen, onClose, cart, totalPrice, onProceedToPayment }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    customerName: '',
    mobileNumber: '',
    address: '',
    landmark: '',
    deliveryInstructions: '',
    location: null
  });

  // Debug logging
  console.log('CheckoutConfirmation render - isOpen:', isOpen, 'cart:', cart, 'totalPrice:', totalPrice);
  
  // Test if component is rendering
  if (isOpen) {
    console.log('CheckoutConfirmation: Modal should be visible!');
  }

  // Set animation state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the modal is rendered before animation
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleProceed = () => {
    console.log('CheckoutConfirmation: handleProceed called');
    setShowDeliveryForm(true);
  };

  const handleDeliverySubmit = (e) => {
    e.preventDefault();
    console.log('CheckoutConfirmation: Delivery Info to be submitted:', deliveryInfo);
    
    // Validate required fields
    if (!deliveryInfo.customerName || !deliveryInfo.mobileNumber || !deliveryInfo.address) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate mobile number
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(deliveryInfo.mobileNumber)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!deliveryInfo.location?.confirmed || !deliveryInfo.location?.lat || !deliveryInfo.location?.lng) {
      alert('Please set and confirm your delivery location on the map.');
      return;
    }

    console.log('CheckoutConfirmation: Validation passed, calling onProceedToPayment with:', deliveryInfo);
    console.log('CheckoutConfirmation: onProceedToPayment function:', onProceedToPayment);
    if (onProceedToPayment) {
      // Pass delivery info along with the proceed call
      onProceedToPayment(deliveryInfo);
    } else {
      console.error('CheckoutConfirmation: onProceedToPayment is not defined!');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDeliveryInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[94vh] overflow-y-auto transform transition-all duration-300 pb-safe ${
          isAnimating ? 'translate-y-0 sm:scale-100 opacity-100' : 'translate-y-8 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
              <p className="text-sm text-gray-600">Review your order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[78vh] overflow-y-auto">
          {!showDeliveryForm ? (
            <>
              {/* Order Summary */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Order Summary</h3>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={getFishImageUrl(item.image)}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg"
                          onError={handleImageError}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            Qty: {normalizeQuantity(item.quantity).toFixed(1)} kg
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-blue-600">
                          ₹{calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900">Total Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">₹{parseFloat(totalPrice).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-6 h-6 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Payment Method</p>
                    <p className="text-sm text-gray-600">UPI QR Code Payment</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:space-x-3 sm:gap-0">
                <button
                  onClick={onClose}
                  className="flex-1 min-h-[48px] py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Button clicked directly!');
                    handleProceed();
                  }}
                  className="flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-800"
                >
                  <span>Add Delivery Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Delivery Information Form */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Delivery Information</h3>
                    <p className="text-sm text-gray-600">Please provide your delivery details</p>
                  </div>
                </div>

                <form onSubmit={handleDeliverySubmit} className="space-y-4">
                  {/* Customer Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="w-4 h-4 inline mr-1" />
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={deliveryInfo.customerName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      name="mobileNumber"
                      value={deliveryInfo.mobileNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Enter 10-digit mobile number"
                      maxLength="10"
                      required
                    />
                  </div>

                  {/* Delivery Location Map */}
                  <DeliveryLocationPicker
                    key="delivery-location-picker"
                    onChange={(location) => {
                      setDeliveryInfo((prev) => ({ ...prev, location }));
                    }}
                  />

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Complete Address *
                    </label>
                    <textarea
                      name="address"
                      value={deliveryInfo.address}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="House/Flat No., Building, Street, City, Pincode"
                      required
                    />
                  </div>

                  {/* Landmark */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Landmark
                    </label>
                    <input
                      type="text"
                      name="landmark"
                      value={deliveryInfo.landmark}
                      onChange={handleInputChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Nearby landmark (optional)"
                    />
                  </div>

                  {/* Delivery Instructions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Instructions
                    </label>
                    <textarea
                      name="deliveryInstructions"
                      value={deliveryInfo.deliveryInstructions}
                      onChange={handleInputChange}
                      rows="2"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Any special delivery instructions (optional)"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:space-x-3 sm:gap-0 pt-4 sticky bottom-0 bg-white pb-1">
                    <button
                      type="button"
                      onClick={() => setShowDeliveryForm(false)}
                      className="flex-1 min-h-[48px] py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-100"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 text-white rounded-xl font-semibold active:bg-green-800"
                    >
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutConfirmation;
