import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const QRModal = ({ 
  fish, 
  shopInfo, 
  onClose, 
  isCheckoutFlow = false, 
  cart = [], 
  totalPrice = 0, 
  onPaymentDone = null
}) => {
  const [copied, setCopied] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const upiId = shopInfo.upiId;
  const payeeName = shopInfo.name || 'PR Nexus FishMart';
  
  // For checkout flow, use cart total; for single fish, use fish rate
  const rawAmount = isCheckoutFlow ? totalPrice : fish.rate;
  const amount = Number(rawAmount || 0).toFixed(2);
  // Standard UPI intent — when scanned inside PhonePe / GPay, opens pay screen with amount
  const upiParams = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${payeeName}`)}`;
  const upiLink = `upi://pay?${upiParams}`;
  const gpayLink = `gpay://upi/pay?${upiParams}`;
  const phonePeLink = `phonepe://pay?${upiParams}`;
  const paytmLink = `paytmmp://pay?${upiParams}`;

  // Detect mobile / iOS (Safari cannot open Android-style UPI deep links reliably)
  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent || '';
      const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMobileDevice = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setIsIOS(ios);
      setIsMobile(isMobileDevice);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const copyUPI = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy UPI ID:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = upiId;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const openAppLink = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openUPI = () => {
    // iPhone Safari / iOS UPI deep links usually fail with "Something went wrong"
    if (isIOS) {
      alert(
        `On iPhone:\n\n1. Open PhonePe or Google Pay\n2. Tap Scan QR\n3. Scan this screen's QR\n\nOr Copy UPI ID and pay ₹${amount} to ${upiId}`
      );
      return;
    }

    try {
      openAppLink(upiLink);
    } catch (error) {
      console.error('Error opening UPI app:', error);
      alert(`Please open your UPI app manually and use:\nUPI ID: ${upiId}\nAmount: ₹${amount}`);
    }
  };

  const openPhonePe = () => {
    openAppLink(phonePeLink);
    // Fallback to generic UPI after a moment if app not installed
    setTimeout(() => openAppLink(upiLink), 1200);
  };

  const openGPay = () => {
    openAppLink(gpayLink);
    setTimeout(() => openAppLink(upiLink), 1200);
  };

  const openPaytm = () => {
    openAppLink(paytmLink);
    setTimeout(() => openAppLink(upiLink), 1200);
  };

  const handlePaymentDone = () => {
    if (isCheckoutFlow && onPaymentDone && transactionId.trim()) {
      onPaymentDone(transactionId.trim());
    }
  };

  // Debug logging
  console.log('QRModal render - isCheckoutFlow:', isCheckoutFlow, 'totalPrice:', totalPrice, 'cart:', cart);
  console.log('QRModal - upiId:', upiId, 'upiLink:', upiLink, 'amount:', amount);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-3xl sm:rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">💳</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {isCheckoutFlow ? 'Secure Payment' : `Pay for ${fish.name}`}
                </h3>
                <p className="text-blue-100 text-sm">Complete your payment securely</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white hover:text-gray-200"
              title="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Enhanced Horizontal Layout */}
        <div className="p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Left Side: Order Summary - Enhanced */}
            <div className="lg:w-1/3">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">💰</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Order Summary</h4>
                    <p className="text-sm text-green-600">Payment Details</p>
                  </div>
                </div>
                {isCheckoutFlow ? (
                  <>
                    <div className="bg-white/60 p-4 rounded-xl">
                      <p className="text-3xl font-bold text-green-600 mb-2">₹{totalPrice}</p>
                      <p className="text-sm text-gray-600">{cart.length} items in cart</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white/60 p-4 rounded-xl">
                      <p className="text-lg font-semibold text-gray-900 mb-2">{fish.name}</p>
                      <p className="text-2xl font-bold text-green-600">₹{fish.rate} / {fish.unit}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Center: QR Code Section - Hidden on Mobile, Shown on Desktop */}
            {!isMobile && (
              <div className="lg:w-1/3 flex flex-col items-center">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-2xl">📱</span>
                    <h4 className="text-xl font-bold text-gray-900">Scan QR Code</h4>
                  </div>
                  <p className="text-sm text-gray-600 bg-blue-100 px-3 py-1 rounded-full inline-block">
                    Use any UPI app to scan
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border-2 border-blue-200 shadow-xl">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl">
                    <QRCodeCanvas
                      value={upiLink}
                      size={208}
                      className="mx-auto"
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500">PhonePe • UPI</p>
                    <p className="text-xs text-gray-400 mt-1">Amount: ₹{amount}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile: large UPI QR (scan in PhonePe/GPay) + app buttons */}
            {isMobile && (
              <div className="lg:w-1/3 flex flex-col items-center w-full">
                <div className="bg-white rounded-2xl p-5 w-full text-center shadow-xl border border-blue-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-1">Scan QR to Pay</h4>
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
                    Open <strong>PhonePe</strong> or <strong>Google Pay</strong> → tap <strong>Scan QR</strong> → point at this code
                  </p>
                  {isIOS && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
                      iPhone: use Scan inside PhonePe/GPay (Safari camera may not open payment).
                    </p>
                  )}
                  <div className="bg-white p-3 rounded-xl border-2 border-blue-200 inline-block mb-2 shadow-sm">
                    <QRCodeCanvas
                      value={upiLink}
                      size={220}
                      className="mx-auto"
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-base font-bold text-gray-900">₹{amount}</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-3">PhonePe • Google Pay • any UPI app</p>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={openPhonePe}
                      className="min-h-[48px] rounded-xl bg-[#5f259f] text-white text-sm font-bold active:opacity-90"
                    >
                      Open PhonePe
                    </button>
                    <button
                      type="button"
                      onClick={openGPay}
                      className="min-h-[48px] rounded-xl bg-[#1a73e8] text-white text-sm font-bold active:opacity-90"
                    >
                      Open GPay
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={isIOS ? copyUPI : openUPI}
                    className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold active:bg-gray-50 mb-2"
                  >
                    {isIOS ? (copied ? 'UPI ID Copied!' : 'Copy UPI ID') : `Pay ₹${amount} (Any UPI)`}
                  </button>
                  {isIOS && (
                    <button
                      type="button"
                      onClick={openPaytm}
                      className="w-full min-h-[40px] rounded-xl text-xs font-medium text-gray-500"
                    >
                      Try Paytm
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Right Side: UPI ID Section - Enhanced */}
            <div className="lg:w-1/3">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">🔗</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">UPI Details</h4>
                    <p className="text-sm text-purple-600">
                      {isMobile ? 'Manual Entry' : 'Manual Entry'}
                    </p>
                  </div>
                </div>
                <div className="bg-white/60 p-4 rounded-xl">
                  <p className="text-sm text-gray-600 mb-2">UPI ID:</p>
                  <p className="font-mono text-sm break-all bg-gray-100 p-2 rounded border">{upiId}</p>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span>🏪</span> {shopInfo.name}
                  </p>
                  {isMobile && (
                    <p className="text-xs text-purple-600 mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                      {isIOS
                        ? '💡 iPhone: Copy UPI ID → open PhonePe/GPay → pay manually'
                        : `💡 Copy UPI ID → Open your UPI app → Paste → Enter ₹${amount} → Pay`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction ID Input for Checkout Flow - Enhanced */}
          {isCheckoutFlow && (
            <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">🔐</span>
                  <h4 className="text-lg font-bold text-gray-900">Transaction Verification</h4>
                </div>
                <p className="text-sm text-gray-600">Enter your transaction ID to complete payment</p>
              </div>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter transaction ID from your payment app"
                className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-medium text-lg"
              />
              <p className="text-xs text-gray-500 text-center mt-2">
                💡 Check your payment app for the transaction ID
              </p>
            </div>
          )}

          {/* Enhanced Action Buttons */}
          <div className="mt-6 lg:mt-8 space-y-4">
            {isMobile ? (
              // Mobile: Simplified button layout
              <div className="space-y-3">
                <button
                  onClick={copyUPI}
                  className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    copied 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {copied ? <span>✅</span> : <span>📋</span>}
                    {copied ? 'UPI ID Copied!' : 'Copy UPI ID'}
                  </div>
                </button>
              </div>
            ) : (
              // Desktop: Both buttons side by side
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={copyUPI}
                  className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    copied 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {copied ? <span>✅</span> : <span>📋</span>}
                    {copied ? 'Copied!' : 'Copy UPI ID'}
                  </div>
                </button>
                
                <button
                  onClick={openUPI}
                  className="flex-1 py-4 px-6 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>📱</span>
                    Open UPI App
                  </div>
                </button>
              </div>
            )}

            {/* Payment Done Button for Checkout Flow */}
            {isCheckoutFlow && (
              <button
                onClick={handlePaymentDone}
                disabled={!transactionId.trim()}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                  transactionId.trim()
                    ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-700 hover:to-emerald-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>✅</span>
                  Complete Payment
                </div>
              </button>
            )}

            {/* Cancel Button - Enhanced */}
            <button
              onClick={onClose}
              className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-300"
            >
              <div className="flex items-center justify-center gap-2">
                <span>❌</span>
                Cancel Payment
              </div>
            </button>
          </div>

          {/* Enhanced Footer */}
          <div className="mt-6 text-center">
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-4">
              <p className="text-sm text-gray-700 font-medium">
                🔒 Secure payment powered by UPI • Use Google Pay, PhonePe, or Paytm
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRModal;

