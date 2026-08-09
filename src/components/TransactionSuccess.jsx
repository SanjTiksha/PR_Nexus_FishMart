import { useState, useEffect } from 'react';
import { CheckCircle, X, Home, ShoppingBag, MessageCircle } from 'lucide-react';
import { calculateLineTotal, normalizeQuantity } from '../utils/quantityUtils';
import {
  getOrderFinancialBreakdown,
  formatOrderDiscountLabel,
} from '../utils/orderFinancialDisplay';
import { getPaymentStatusLabel, openOrderWhatsApp } from '../utils/orderWhatsApp';

const TransactionSuccess = ({ isOpen, order, onClose, onContinueShopping, shopInfo }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const isPendingConfirmation =
    order.paymentStatus === 'PENDING_CONFIRMATION' ||
    (order.paidVerified === false && order.paymentStatus !== 'FAILED' && order.paymentStatus !== 'VERIFIED');

  // Historical totals from order snapshot — never recalculate from live settings
  const financial = getOrderFinancialBreakdown(order);
  const discountLabel = formatOrderDiscountLabel(financial);
  const deliveryInfo = order.deliveryInfo || {};
  const paymentStatusLabel = getPaymentStatusLabel(order);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Opens WhatsApp only — never writes Firestore, never creates a new order/ID
  const handleWhatsAppShare = () => {
    openOrderWhatsApp(order, shopInfo);
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
        <div className="flex items-center justify-between p-3 sm:p-5 border-b">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                Order Submitted Successfully
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Your order has been recorded successfully.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            type="button"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5 space-y-3 sm:space-y-5 max-h-[78vh] overflow-y-auto">
          {/* 1. Success header + Order Recorded / Payment Pending */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-1">
                Order Submitted Successfully
              </h3>
              <p className="text-sm text-gray-600">
                Your order has been recorded successfully.
              </p>
              <p className="text-sm text-gray-600 mt-2 max-w-xl mx-auto">
                Your payment and order details have been submitted. Our team will verify the payment and process your order shortly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto text-left">
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-green-900">Order</span>
                <span className="text-sm font-semibold text-green-700 whitespace-nowrap">Recorded ✓</span>
              </div>
              {isPendingConfirmation ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-orange-900">Payment</span>
                  <span className="text-sm font-semibold text-orange-700 whitespace-nowrap">
                    Pending Verification 🟠
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-green-900">Payment</span>
                  <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                    {paymentStatusLabel} ✓
                  </span>
                </div>
              )}
            </div>

            {order.orderId && (
              <p className="text-xs text-gray-500">
                Order ID: <span className="font-mono text-blue-600">{order.orderId}</span>
              </p>
            )}
            {order.transactionId && (
              <p className="text-xs text-gray-500">UTR / Txn ID: {order.transactionId}</p>
            )}
          </div>

          {/* 2. WhatsApp CTA — prominent, near top (especially mobile) */}
          <div className="rounded-2xl border-2 border-[#25D366] bg-[#E8F8EF] p-3 sm:p-4 space-y-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base sm:text-lg font-bold text-gray-900">
                📱 Send Your Order on WhatsApp
              </h4>
              <span className="inline-flex items-center rounded-md bg-[#25D366]/15 px-2 py-0.5 text-[11px] font-semibold text-[#128C7E]">
                Recommended for faster processing
              </span>
            </div>
            <p className="text-sm text-gray-700">
              Your order is already recorded. Please send the order details on WhatsApp so our team can quickly receive and process your request.
            </p>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full min-h-[52px] flex items-center justify-center space-x-2 py-3 px-4 bg-[#25D366] hover:bg-[#1ebe57] active:bg-[#128C7E] text-white rounded-xl font-bold text-base shadow-md"
            >
              <MessageCircle className="w-5 h-5" />
              <span>💬 Send Order Details on WhatsApp</span>
            </button>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold text-[#128C7E]">Recommended:</span>{' '}
              Send your order details on WhatsApp for faster processing. Your order is already recorded even if you skip this step.
            </p>
          </div>

          {/* 3–5. Order Information / Summary / Delivery */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
            <div className="space-y-3 sm:space-y-5">
              {/* 3. Order Information */}
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2">
                <h4 className="font-semibold text-gray-900 mb-1">Order Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-600">Order ID:</span>
                    <span className="text-sm font-mono text-blue-600 break-all text-right">{order.orderId}</span>
                  </div>
                  {order.transactionId && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-600">UTR / Txn ID:</span>
                      <span className="text-sm font-mono text-gray-800 break-all text-right">{order.transactionId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-600">Date & Time:</span>
                    <span className="text-sm text-gray-900 text-right">{formatDate(order.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-600">Order status:</span>
                    <span className="text-sm font-semibold text-green-700">Recorded ✓</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-600">Payment:</span>
                    <span
                      className={`text-sm font-semibold ${
                        isPendingConfirmation ? 'text-orange-700' : 'text-green-700'
                      }`}
                    >
                      {isPendingConfirmation
                        ? 'Pending Verification 🟠'
                        : `${paymentStatusLabel} ✓`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-600">Total Amount:</span>
                    <span className="text-lg font-bold text-green-700">
                      ₹{financial.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-600">Items:</span>
                    <span className="text-sm text-gray-900">{(order.items || []).length} items</span>
                  </div>
                </div>
              </div>

              {/* 4. Order Summary (snapshot) */}
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Order Summary</h4>
                <div className="space-y-2">
                  {(order.items || []).map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-600">
                        {item.name} (×{normalizeQuantity(item.quantity).toFixed(1)} kg)
                      </span>
                      <span className="font-medium shrink-0">
                        ₹{calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-blue-200 pt-2 mt-2 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">₹{financial.subtotal.toFixed(2)}</span>
                    </div>

                    {financial.discount > 0 && (
                      <div className="flex items-center justify-between text-sm text-green-700">
                        <span>{discountLabel}:</span>
                        <span className="font-medium">-₹{financial.discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm font-semibold border-t border-blue-200 pt-1">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-green-700">
                        ₹{financial.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Delivery Information */}
            <div className="space-y-3 sm:space-y-5">
              {order.deliveryInfo ? (
                <div className="bg-green-50 rounded-lg p-3 sm:p-4 space-y-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <Home className="w-4 h-4 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-green-900">Delivery Information</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-green-700 font-medium">Name:</span>
                      <span className="text-green-900 text-right">{order.deliveryInfo.customerName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-green-700 font-medium">Mobile:</span>
                      <span className="text-green-900">{order.deliveryInfo.mobileNumber}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-green-700 font-medium">Address:</span>
                      <span className="text-green-900 text-right">{order.deliveryInfo.address}</span>
                    </div>
                    {order.deliveryInfo.landmark && (
                      <div className="flex justify-between gap-2">
                        <span className="text-green-700 font-medium">Landmark:</span>
                        <span className="text-green-900 text-right">{order.deliveryInfo.landmark}</span>
                      </div>
                    )}
                    {order.deliveryInfo.deliveryInstructions && (
                      <div className="flex justify-between gap-2">
                        <span className="text-green-700 font-medium">Instructions:</span>
                        <span className="text-green-900 text-right">{order.deliveryInfo.deliveryInstructions}</span>
                      </div>
                    )}
                    {order.deliveryInfo.location?.lat && order.deliveryInfo.location?.lng && (
                      <div className="pt-2 mt-1 border-t border-green-200 space-y-1">
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
                <div className="bg-yellow-50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Home className="w-4 h-4 text-yellow-600" />
                    </div>
                    <h4 className="font-semibold text-yellow-900">Delivery Information</h4>
                  </div>
                  <p className="text-sm text-yellow-700">No delivery information provided. Please contact the shop for delivery details.</p>
                </div>
              )}
            </div>
          </div>

          {/* 6. Continue Shopping / Go Home */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onContinueShopping}
              className="flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-800"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
            </button>
            <button
              type="button"
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
