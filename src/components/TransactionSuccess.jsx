import { useState, useEffect } from 'react';
import { CheckCircle, X, Clock, Receipt, Home, ShoppingBag, MessageCircle } from 'lucide-react';
import { calculateLineTotal, normalizeQuantity } from '../utils/quantityUtils';

const TransactionSuccess = ({ isOpen, order, onClose, onContinueShopping, shopInfo, fishData }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Debug logging
  useEffect(() => {
    if (isOpen && order) {
      console.log('TransactionSuccess: Order data received:', order);
      console.log('TransactionSuccess: Delivery info:', order.deliveryInfo);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const isPendingConfirmation =
    order.paymentStatus === 'PENDING_CONFIRMATION' || order.paidVerified === false;

  // Calculate discount
  const getSubtotal = () => {
    return order.items.reduce(
      (total, item) => total + calculateLineTotal(item.price || item.rate, item.quantity),
      0,
    );
  };

  const getDiscount = () => {
    const subtotal = getSubtotal();
    const discountSettings = fishData?.discountSettings || { isEnabled: true, percentage: 5, minimumAmount: 1000 };
    
    if (discountSettings.isEnabled && subtotal >= discountSettings.minimumAmount) {
      return parseFloat((subtotal * (discountSettings.percentage / 100)).toFixed(2));
    }
    return 0;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleWhatsAppShare = () => {
    const orderSummary = order.items.map(item => 
      `• ${item.name} (Qty: ${normalizeQuantity(item.quantity).toFixed(1)} kg) - ₹${calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}`
    ).join('\n');
    
    const subtotal = getSubtotal();
    const discount = getDiscount();
    const discountText = discount > 0 ? 
      `\n*Subtotal:* ₹${subtotal.toFixed(2)}\n*Discount:* -₹${discount.toFixed(2)}` : '';
    
    // Get delivery information from the order
    const deliveryInfo = order.deliveryInfo || {};
    
    // Build delivery address string
    let deliveryAddress = '';
    if (deliveryInfo.address || deliveryInfo.location?.lat) {
      deliveryAddress = `\n\n*📍 Delivery Address:*
*Name:* ${deliveryInfo.customerName || 'Not provided'}
*Mobile:* ${deliveryInfo.mobileNumber || 'Not provided'}
*Address:* ${deliveryInfo.address || 'Not provided'}`;
      
      if (deliveryInfo.landmark) {
        deliveryAddress += `\n*Landmark:* ${deliveryInfo.landmark}`;
      }
      
      if (deliveryInfo.deliveryInstructions) {
        deliveryAddress += `\n*Delivery Instructions:* ${deliveryInfo.deliveryInstructions}`;
      }

      const loc = deliveryInfo.location;
      if (loc?.lat && loc?.lng) {
        deliveryAddress += `\n\n*📍 Live Delivery Location:*
*Coordinates:* ${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}${loc.accuracy ? `\n*GPS Accuracy:* ±${Math.round(loc.accuracy)}m` : ''}
*Google Maps:* ${loc.mapsUrl || `https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
*Navigate (for delivery boy):* ${loc.navigateUrl || `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`}`;
      }
    }
    
    const message = `🎉 *Order Confirmation* 🎉

*Order ID:* ${order.orderId}
${order.transactionId ? `*Transaction ID:* ${order.transactionId}` : ''}
*Date:* ${formatDate(order.timestamp)}
*Total Amount:* ₹${parseFloat(order.totalPrice).toFixed(2)}
*Items:* ${order.items.length} items

*Items Ordered:*
${orderSummary}${discountText}${deliveryAddress}

*Shop:* ${shopInfo?.name || 'PR Nexus FishMart'}
*Contact:* ${shopInfo?.phone?.replace(/[^\d+]/g, '') || 'Contact shop for details'}

Thank you for your order! 🐟`;

    const whatsappUrl = `https://wa.me/${shopInfo?.whatsapp || '919096205136'}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl max-h-[94vh] overflow-hidden transform transition-all duration-300 pb-safe ${
          isAnimating ? 'translate-y-0 sm:scale-100 opacity-100' : 'translate-y-8 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isPendingConfirmation ? 'Order Placed Successfully' : 'Payment Successful!'}
              </h2>
              <p className="text-sm text-gray-600">
                {isPendingConfirmation
                  ? 'Thank you — your order is recorded'
                  : 'Your order has been placed'}
              </p>
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
          {/* Success Animation */}
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-green-600">
              {isPendingConfirmation ? 'Thank You for Your Order!' : 'Transaction Complete!'}
            </h3>
            <p className="text-gray-600">
              {isPendingConfirmation
                ? 'Your order and UPI transaction ID have been submitted successfully. Our team will verify the payment and process delivery shortly. This is not a payment failure.'
                : 'Thank you for your purchase. Your order is being processed.'}
            </p>
            {order.paymentRef && (
              <p className="text-xs text-gray-500 mt-2">Payment ref: {order.paymentRef}</p>
            )}
            {order.transactionId && (
              <p className="text-xs text-gray-500 mt-1">UTR / Txn ID: {order.transactionId}</p>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Order Details */}
            <div className="space-y-6">
              {/* Order Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-gray-900 mb-3">Order Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Order ID:</span>
                    <span className="text-sm font-mono text-blue-600 break-all">{order.orderId}</span>
                  </div>
                  {order.transactionId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Transaction ID:</span>
                      <span className="text-sm font-mono text-green-600 break-all">{order.transactionId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Date & Time:</span>
                    <span className="text-sm text-gray-900 text-right">{formatDate(order.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Total Amount:</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{parseFloat(order.totalPrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Items:</span>
                    <span className="text-sm text-gray-900">{order.items.length} items</span>
                  </div>
                </div>
              </div>

              {/* Order Items Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {item.name} (×{normalizeQuantity(item.quantity).toFixed(1)} kg)
                      </span>
                      <span className="font-medium">
                        ₹{calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  
                  {/* Price Breakdown */}
                  <div className="border-t border-blue-200 pt-2 mt-3 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">₹{getSubtotal().toFixed(2)}</span>
                    </div>
                    
                    {getDiscount() > 0 && (
                      <div className="flex items-center justify-between text-sm text-green-600">
                        <span>Discount ({fishData?.discountSettings?.percentage || 5}% {fishData?.discountSettings?.description || "off ₹1000+"}):</span>
                        <span className="font-medium">-₹{getDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm font-semibold border-t border-blue-200 pt-1">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-green-600">
                        ₹{parseFloat(order.totalPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Delivery Information */}
            <div className="space-y-6">
              {/* Delivery Information */}
              {order.deliveryInfo ? (
                <div className="bg-green-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <Home className="w-4 h-4 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-green-900">Delivery Information</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700 font-medium">Name:</span>
                      <span className="text-green-900 text-right">{order.deliveryInfo.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700 font-medium">Mobile:</span>
                      <span className="text-green-900">{order.deliveryInfo.mobileNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700 font-medium">Address:</span>
                      <span className="text-green-900 text-right">{order.deliveryInfo.address}</span>
                    </div>
                    {order.deliveryInfo.landmark && (
                      <div className="flex justify-between">
                        <span className="text-green-700 font-medium">Landmark:</span>
                        <span className="text-green-900 text-right">{order.deliveryInfo.landmark}</span>
                      </div>
                    )}
                    {order.deliveryInfo.deliveryInstructions && (
                      <div className="flex justify-between">
                        <span className="text-green-700 font-medium">Instructions:</span>
                        <span className="text-green-900 text-right">{order.deliveryInfo.deliveryInstructions}</span>
                      </div>
                    )}
                    {order.deliveryInfo.location?.lat && order.deliveryInfo.location?.lng && (
                      <div className="pt-2 mt-2 border-t border-green-200 space-y-1">
                        <p className="text-green-700 font-medium">📍 Live Location</p>
                        <p className="text-xs text-green-900 font-mono">
                          {Number(order.deliveryInfo.location.lat).toFixed(6)}, {Number(order.deliveryInfo.location.lng).toFixed(6)}
                        </p>
                        <a
                          href={order.deliveryInfo.location.navigateUrl || `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryInfo.location.lat},${order.deliveryInfo.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-sm text-blue-700 underline"
                        >
                          Open navigation path for delivery →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Home className="w-4 h-4 text-yellow-600" />
                    </div>
                    <h4 className="font-semibold text-yellow-900">Delivery Information</h4>
                  </div>
                  <p className="text-sm text-yellow-700">No delivery information provided. Please contact the shop for delivery details.</p>
                </div>
              )}

              {/* Order Status */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Order Status</p>
                    <p className="text-sm text-blue-700">Processing - Will be ready for pickup/delivery soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="w-full min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 text-white rounded-xl font-semibold active:bg-green-800"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Send to WhatsApp</span>
          </button>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3 sm:gap-0">
            <button
              onClick={onContinueShopping}
              className="flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-800"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-100"
            >
              <Home className="w-4 h-4" />
              <span>Go Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionSuccess;
