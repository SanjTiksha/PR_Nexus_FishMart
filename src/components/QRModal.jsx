import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { resolveMerchantName, resolveMerchantUpiId } from '../config/paymentConfig';
import {
  buildUpiPayment,
  copyTextToClipboard,
  detectPaymentDevice,
  launchUpiPayment,
  logPaymentAttempt,
} from '../utils/upiPayment';

const QRModal = ({
  fish,
  shopInfo,
  onClose,
  isCheckoutFlow = false,
  cart = [],
  totalPrice = 0,
  onPaymentDone = null,
  paymentSession = null,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrSaved, setQrSaved] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [device, setDevice] = useState(() => detectPaymentDevice());
  const [launchMessage, setLaunchMessage] = useState('');
  const [launchError, setLaunchError] = useState('');
  const qrCanvasRef = useRef(null);

  const merchantUpiId = resolveMerchantUpiId(shopInfo);
  const merchantName = resolveMerchantName(shopInfo);

  // Locked session amount takes priority — never invent ₹5
  const payableAmount = paymentSession?.amount ?? (isCheckoutFlow ? totalPrice : fish?.rate);
  const paymentRef =
    paymentSession?.paymentRef ||
    paymentSession?.orderId ||
    `PRN${Date.now().toString(36).toUpperCase()}`;
  const orderId = paymentSession?.orderId || paymentRef;

  const paymentBuild = useMemo(
    () =>
      buildUpiPayment({
        merchantUpiId,
        merchantName,
        amount: payableAmount,
        paymentRef,
      }),
    [merchantUpiId, merchantName, payableAmount, paymentRef],
  );

  const amount = paymentBuild.amount || formatDisplayAmount(payableAmount);
  const upiUri = paymentBuild.upiUri || '';
  const intentUri = paymentBuild.intentUri || '';

  useEffect(() => {
    const refresh = () => setDevice(detectPaymentDevice());
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, []);

  useEffect(() => {
    if (paymentBuild.error) {
      setLaunchError(paymentBuild.error);
      return;
    }
    logPaymentAttempt({
      orderId,
      paymentRef,
      amount: paymentBuild.amount,
      merchantUpiId,
      params: paymentBuild.params,
    });
  }, [orderId, paymentRef, paymentBuild, merchantUpiId]);

  const handleCopyUpi = async () => {
    const ok = await copyTextToClipboard(merchantUpiId);
    if (ok) {
      setCopied(true);
      setLaunchMessage('UPI ID copied');
      setLaunchError('');
      setTimeout(() => setCopied(false), 2000);
    } else {
      setLaunchError('Could not copy UPI ID. Please copy it manually.');
    }
  };

  const handleSaveQrToGallery = async () => {
    setLaunchError('');
    setLaunchMessage('');

    const canvas = qrCanvasRef.current;
    if (!canvas || typeof canvas.toBlob !== 'function') {
      setLaunchError('QR code is not ready. Please wait a moment and try again.');
      return;
    }

    const fileName = `PRNexus-UPI-${paymentRef || 'pay'}.png`;

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (!blob) {
      setLaunchError('Could not save QR code. Please try again.');
      return;
    }

    const file = new File([blob], fileName, { type: 'image/png' });

    // Mobile: Share sheet → Save Image / Photos / Gallery
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${merchantName} UPI QR`,
          text: `Pay ₹${amount} to ${merchantUpiId}`,
        });
        setQrSaved(true);
        setLaunchMessage('QR shared — choose Save Image / Photos to keep it in gallery.');
        setTimeout(() => setQrSaved(false), 2500);
        return;
      }
    } catch (err) {
      // User cancelled share — not an error
      if (err?.name === 'AbortError') return;
    }

    // Fallback: download PNG (Android Chrome / desktop)
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setQrSaved(true);
      setLaunchMessage(
        device.isIOS
          ? 'QR downloaded. Open the image and tap Share → Save Image to add it to Photos.'
          : 'QR saved. Check Downloads / Gallery, then open your UPI app and scan it.',
      );
      setTimeout(() => setQrSaved(false), 2500);
    } catch {
      setLaunchError(
        'Unable to save QR automatically. Long-press the QR image and choose Save Image.',
      );
    }
  };

  const handlePayViaUpi = () => {
    setLaunchError('');
    setLaunchMessage('');

    if (paymentBuild.error || !upiUri) {
      setLaunchError(
        paymentBuild.error ||
          'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.',
      );
      return;
    }

    const result = launchUpiPayment({
      upiUri,
      intentUri,
      isIOS: device.isIOS,
      isAndroid: device.isAndroid,
    });

    if (!result.launched) {
      setLaunchError(
        result.message ||
          'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.',
      );
      return;
    }

    if (device.isIOS) {
      setLaunchMessage(
        result.message ||
          'If your UPI app did not open, copy the UPI ID or scan the QR code in PhonePe / Google Pay.',
      );
    } else {
      setLaunchMessage(
        'UPI app opened. Complete payment there. Opening the app is not payment confirmation.',
      );
    }
  };

  const handleSubmitPaymentClaim = () => {
    if (!isCheckoutFlow || !onPaymentDone || !transactionId.trim()) return;
    onPaymentDone(transactionId.trim(), {
      paymentRef,
      orderId,
      amount: Number(amount),
      status: 'PENDING_CONFIRMATION',
    });
  };

  const { isMobile, isIOS } = device;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-y-auto shadow-2xl border border-gray-100 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">
                {isCheckoutFlow ? 'Secure Payment' : `Pay for ${fish?.name || 'Order'}`}
              </h3>
              <p className="text-blue-100 text-sm">Complete your payment securely</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="Close"
              type="button"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-blue-50 space-y-4">
          {/* Order summary */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-4 sm:p-5 rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-gray-900">Order Summary</h4>
                <p className="text-xs text-green-700">Ref: {paymentRef}</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{amount}</p>
            </div>
            {isCheckoutFlow && (
              <p className="text-sm text-gray-600 mt-2">{cart.length} item(s) · {merchantName}</p>
            )}
            {!isCheckoutFlow && fish?.name && (
              <p className="text-sm text-gray-600 mt-2">
                {fish.name} · ₹{fish.rate}/{fish.unit}
              </p>
            )}
          </div>

          {(launchError || paymentBuild.error) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {launchError || paymentBuild.error}
            </div>
          )}
          {launchMessage && !launchError && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {launchMessage}
            </div>
          )}

          {/* MOBILE order: Pay → Copy → QR → Instructions */}
          {isMobile && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePayViaUpi}
                disabled={!!paymentBuild.error}
                className="w-full min-h-[52px] rounded-xl bg-green-600 text-white text-base font-bold active:bg-green-800 disabled:bg-gray-300"
              >
                Pay ₹{amount} via UPI
              </button>

              <button
                type="button"
                onClick={handleCopyUpi}
                className={`w-full min-h-[48px] rounded-xl font-semibold ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white active:bg-blue-800'
                }`}
              >
                {copied ? 'UPI ID copied' : 'Copy UPI ID'}
              </button>

              <div className="bg-white rounded-2xl border border-blue-200 p-4 text-center">
                <h4 className="text-sm font-bold text-gray-900 mb-1">Scan QR Code</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Open any UPI app → Scan QR → confirm ₹{amount}
                </p>
                {upiUri ? (
                  <div className="inline-block bg-white p-2 rounded-xl border border-gray-100">
                    <QRCodeCanvas
                      ref={qrCanvasRef}
                      value={upiUri}
                      size={168}
                      level="M"
                      includeMargin
                    />
                  </div>
                ) : (
                  <p className="text-sm text-red-600">QR unavailable — check UPI configuration.</p>
                )}
                <p className="font-mono text-xs text-gray-700 mt-3 break-all">{merchantUpiId}</p>
                <button
                  type="button"
                  onClick={handleSaveQrToGallery}
                  disabled={!upiUri}
                  className={`w-full mt-3 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-50 ${
                    qrSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-900 text-white active:bg-black'
                  }`}
                >
                  {qrSaved ? 'QR ready to save' : 'Save QR to Gallery'}
                </button>
                <p className="text-[11px] text-gray-500 mt-2">
                  Save QR → open Paytm / PhonePe / GPay → Scan from gallery / photos
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-xs text-amber-900 space-y-1.5">
                <p className="font-semibold">Payment instructions</p>
                {isIOS ? (
                  <>
                    <p>1. Prefer Copy UPI ID or Scan QR inside Paytm / PhonePe / Google Pay.</p>
                    <p>2. Safari often cannot open UPI apps reliably.</p>
                  </>
                ) : (
                  <>
                    <p>1. Tap Pay via UPI and choose your UPI app.</p>
                    <p>2. Or scan the QR / copy UPI ID as fallback.</p>
                  </>
                )}
                <p>3. Opening a UPI app is not payment confirmation.</p>
                <p>
                  4. If the bank rejects payment: no amount is marked paid — try again or another UPI
                  app.
                </p>
              </div>
            </div>
          )}

          {/* DESKTOP order: QR → UPI ID → Copy → Instructions */}
          {!isMobile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-5 text-center shadow-sm">
                <h4 className="text-lg font-bold text-gray-900 mb-1">Scan QR Code</h4>
                <p className="text-sm text-gray-500 mb-4">Use any UPI app to scan</p>
                {upiUri ? (
                  <div className="inline-block bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl">
                    <QRCodeCanvas
                      ref={qrCanvasRef}
                      value={upiUri}
                      size={208}
                      level="M"
                      includeMargin
                    />
                  </div>
                ) : (
                  <p className="text-sm text-red-600">QR unavailable</p>
                )}
                <p className="text-xs text-gray-500 mt-3">Amount: ₹{amount}</p>
                <button
                  type="button"
                  onClick={handleSaveQrToGallery}
                  disabled={!upiUri}
                  className={`w-full mt-3 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-50 ${
                    qrSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-900 text-white hover:bg-black'
                  }`}
                >
                  {qrSaved ? 'QR saved' : 'Save QR to Gallery'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-5 rounded-2xl">
                  <h4 className="text-lg font-bold text-gray-900 mb-2">UPI ID</h4>
                  <p className="font-mono text-sm break-all bg-white p-3 rounded border">{merchantUpiId}</p>
                  <p className="text-xs text-gray-500 mt-2">🏪 {merchantName}</p>
                  <p className="text-xs text-gray-500">Payment ref: {paymentRef}</p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className={`w-full min-h-[48px] rounded-xl font-semibold ${
                    copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? 'UPI ID copied' : 'Copy UPI ID'}
                </button>

                <button
                  type="button"
                  onClick={handlePayViaUpi}
                  className="w-full min-h-[48px] rounded-xl bg-green-600 text-white font-bold hover:bg-green-700"
                >
                  Pay ₹{amount} via UPI
                </button>

                <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-800">Payment instructions</p>
                  <p>Scan the QR or copy the UPI ID in your UPI app.</p>
                  <p>Opening a UPI link is not payment confirmation.</p>
                  <p>
                    If payment fails at the bank/UPI app, no amount is marked paid on this order.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pending confirmation — not verified PAID */}
          {isCheckoutFlow && (
            <div className="bg-white/90 rounded-2xl p-4 sm:p-6 border border-gray-200">
              <h4 className="text-base font-bold text-gray-900 mb-1">After you pay</h4>
              <p className="text-sm text-gray-600 mb-3">
                Enter the UTR / transaction ID from your UPI app. Your order will be saved as{' '}
                <strong>payment pending confirmation</strong> (not auto-marked paid).
              </p>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter UTR / transaction ID"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-center font-medium"
              />
              <button
                type="button"
                onClick={handleSubmitPaymentClaim}
                disabled={!transactionId.trim()}
                className={`w-full mt-3 min-h-[48px] rounded-xl font-semibold ${
                  transactionId.trim()
                    ? 'bg-blue-700 text-white active:bg-blue-900'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                I&apos;ve completed payment (pending verification)
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-50"
          >
            Cancel Payment
          </button>

          <p className="text-center text-xs text-gray-500">
            Secure UPI payment · Bank/UPI rejection is outside this website&apos;s control
          </p>
        </div>
      </div>
    </div>
  );
};

function formatDisplayAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

export default QRModal;
