import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { resolveMerchantName, resolveMerchantUpiId } from '../config/paymentConfig';
import {
  buildUpiPayment,
  copyTextToClipboard,
  detectPaymentDevice,
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
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState('');
  const qrCanvasRef = useRef(null);

  const merchantUpiId = resolveMerchantUpiId(shopInfo);
  const merchantName = resolveMerchantName(shopInfo);

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

  /**
   * Save QR into Photos/Gallery.
   * Websites cannot write silently to the gallery — on phone we use the system
   * share sheet so the user can tap "Save Image" / "Photos" (one OS tap, no site confirm).
   */
  const handleSaveQrToGallery = async () => {
    setLaunchError('');
    setLaunchMessage('');

    const canvas = qrCanvasRef.current;
    if (!canvas || typeof canvas.toBlob !== 'function') {
      setLaunchError('QR code is not ready. Please wait a moment and try again.');
      return;
    }

    const fileName = `PRNexus-UPI-${paymentRef || 'pay'}.png`;

    let blob;
    try {
      blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
    } catch {
      setLaunchError('Could not create QR image. Please try again.');
      return;
    }

    if (!blob) {
      setLaunchError('Could not save QR code. Please try again.');
      return;
    }

    const file = new File([blob], fileName, { type: 'image/png' });
    const isPhone = device.isMobile || device.isIOS || device.isAndroid;

    // Phone: share sheet → Save Image / Photos / Gallery (real gallery path)
    if (isPhone && typeof navigator.share === 'function') {
      try {
        const shareData = { files: [file], title: 'UPI QR' };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setQrSaved(true);
          setLaunchMessage(
            'In the share menu tap Save Image / Photos / Gallery to keep the QR in your gallery.',
          );
          setTimeout(() => setQrSaved(false), 3500);
          return;
        }
      } catch (err) {
        // User dismissed share sheet — not an error
        if (err?.name === 'AbortError') return;
        // fall through to download
      }
    }

    // Desktop / share unavailable: download PNG (often Downloads folder, not Photos)
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setQrSaved(true);
      setLaunchMessage(
        isPhone
          ? 'File downloaded. Open Downloads, open the QR image, then Share → Save to Photos/Gallery. Or long-press the QR above → Save Image.'
          : 'QR downloaded. On phone, use Save QR so it can go to Photos/Gallery.',
      );
      setTimeout(() => setQrSaved(false), 4000);
    } catch {
      setLaunchError('Unable to save QR. Long-press the QR image and choose Save Image.');
    }
  };

  const handleSubmitPaymentClaim = async () => {
    if (!isCheckoutFlow || !onPaymentDone || !transactionId.trim() || isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    setOrderSaveError('');
    try {
      const result = await onPaymentDone(transactionId.trim(), {
        paymentRef,
        orderId,
        amount: Number(amount),
        status: 'PENDING_CONFIRMATION',
      });
      if (result && result.success === false) {
        setOrderSaveError('Unable to record your order. Please try again.');
      }
    } catch {
      setOrderSaveError('Unable to record your order. Please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const qrSize = device.isMobile ? 200 : 220;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[94vh] overflow-y-auto shadow-2xl border border-gray-100 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">
                {isCheckoutFlow ? 'Secure Payment' : `Pay for ${fish?.name || 'Order'}`}
              </h3>
              <p className="text-blue-100 text-sm">Scan QR or copy UPI ID to pay</p>
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

        <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-blue-50 space-y-4">
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

          {/* QR only — no auto-open app buttons */}
          <div className="bg-white rounded-2xl border border-blue-200 p-4 sm:p-5 text-center">
            <h4 className="text-base font-bold text-gray-900 mb-1">Scan QR Code</h4>
            <p className="text-xs text-gray-500 mb-3">
              Open GPay / PhonePe / Paytm → Scan QR → pay ₹{amount}
            </p>
            {upiUri ? (
              <div className="inline-block bg-white p-2 rounded-xl border border-gray-100">
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={upiUri}
                  size={qrSize}
                  level="M"
                  includeMargin
                />
              </div>
            ) : (
              <p className="text-sm text-red-600">QR unavailable — check UPI configuration.</p>
            )}
            <p className="font-mono text-xs text-gray-700 mt-3 break-all">{merchantUpiId}</p>
            <p className="text-xs text-gray-500 mt-1">{merchantName}</p>

            <button
              type="button"
              onClick={handleSaveQrToGallery}
              disabled={!upiUri}
              className={`w-full mt-4 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-50 ${
                qrSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-900 text-white active:bg-black'
              }`}
            >
              {qrSaved ? 'QR ready' : 'Save QR to Photos / Gallery'}
            </button>
            <p className="text-[11px] text-gray-500 mt-2">
              Phone: tap button → choose <strong>Save Image</strong> / Photos. Or long-press the QR
              → Save Image.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyUpi}
            className={`w-full min-h-[48px] rounded-xl font-semibold ${
              copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white active:bg-blue-800'
            }`}
          >
            {copied ? 'UPI ID copied' : 'Copy UPI ID'}
          </button>

          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-800">How to pay</p>
            <p>1. Scan the QR in your UPI app, or Copy UPI ID and send ₹{amount}.</p>
            <p>
              2. Or Save QR → tap Save Image in the share menu → open UPI app → scan from Photos.
            </p>
            <p>3. After payment, enter UTR below and submit order.</p>
          </div>

          {isCheckoutFlow && (
            <div className="bg-white/90 rounded-2xl p-4 sm:p-5 border border-gray-200">
              <h4 className="text-base font-bold text-gray-900 mb-1">After you pay</h4>
              <p className="text-sm text-gray-600 mb-3">
                Enter the UTR / transaction ID from your UPI app, then submit your order.
              </p>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => {
                  setTransactionId(e.target.value);
                  if (orderSaveError) setOrderSaveError('');
                }}
                placeholder="Enter UTR / transaction ID"
                disabled={isSubmittingOrder}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-center font-medium disabled:opacity-60"
              />
              {orderSaveError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <p className="font-semibold">Unable to record your order</p>
                  <p>Please try again.</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleSubmitPaymentClaim}
                disabled={!transactionId.trim() || isSubmittingOrder}
                className={`w-full mt-3 min-h-[48px] rounded-xl font-semibold ${
                  transactionId.trim() && !isSubmittingOrder
                    ? 'bg-green-600 text-white active:bg-green-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmittingOrder ? 'Recording order…' : 'Submit order'}
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
