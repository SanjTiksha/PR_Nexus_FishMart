import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { resolveMerchantName, resolveMerchantUpiId } from '../config/paymentConfig';
import {
  buildUpiPayment,
  copyTextToClipboard,
  detectPaymentDevice,
  launchGpayQrPayment,
  launchSpecificUpiApp,
  launchUpiPayment,
  logPaymentAttempt,
  UPI_PAYMENT_APPS,
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
  const appLinks = paymentBuild.appLinks || {};

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

  const handlePayViaGpayQr = async () => {
    setLaunchError('');
    setLaunchMessage('');

    if (paymentBuild.error || !appLinks?.upi) {
      setLaunchError(
        paymentBuild.error ||
          'Unable to open Google Pay. Scan the QR code or copy the UPI ID instead.',
      );
      return;
    }

    // Always copy UPI ID first — if GPay rejects the deep link, paste in Send money works
    const copiedOk = await copyTextToClipboard(merchantUpiId);
    if (copiedOk) setCopied(true);

    const result = launchGpayQrPayment({
      appLinks,
      isAndroid: device.isAndroid,
      isIOS: device.isIOS,
    });

    if (!result.launched) {
      setLaunchError(result.message);
      return;
    }

    setLaunchMessage(
      copiedOk
        ? `UPI ID copied · Opening GPay for ₹${amount}. If GPay shows an error: New payment → paste UPI ID → enter ₹${amount} → Pay.`
        : `Opening GPay for ₹${amount}. If it fails: Copy UPI ID → GPay Send money → Pay ₹${amount}.`,
    );
  };

  const handlePayWithApp = (app) => {
    setLaunchError('');
    setLaunchMessage('');

    if (paymentBuild.error || !appLinks?.upi) {
      setLaunchError(
        paymentBuild.error ||
          'Unable to open that UPI app. Copy the UPI ID or scan the QR code instead.',
      );
      return;
    }

    // Desktop: guide to QR / copy — custom schemes rarely work in desktop browsers
    if (!device.isIOS && !device.isAndroid) {
      setLaunchMessage(
        `On desktop, scan the QR with ${app.label} on your phone, or copy the UPI ID.`,
      );
      return;
    }

    // GPay: open with QR payload via package-pinned Android intent
    if (app.id === 'gpay') {
      handlePayViaGpayQr();
      return;
    }

    const primaryUrl = appLinks[app.linkKey] || appLinks.upi;
    const fallbackUrl = app.fallbackKey ? appLinks[app.fallbackKey] : null;

    const result = launchSpecificUpiApp({ primaryUrl, fallbackUrl });

    if (!result.launched) {
      setLaunchError(result.message);
      return;
    }

    setLaunchMessage(
      app.id === 'whatsapp'
        ? 'Opening UPI chooser — select WhatsApp Pay if listed. Or Copy UPI ID and pay inside WhatsApp.'
        : result.message,
    );
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

          {/* MOBILE: GPay QR link → apps → Copy → QR → Instructions */}
          {isMobile && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePayViaGpayQr}
                disabled={!!paymentBuild.error}
                className="w-full min-h-[56px] rounded-xl bg-[#1a73e8] text-white text-base font-bold active:opacity-90 disabled:bg-gray-300"
              >
                Pay ₹{amount} in Google Pay
              </button>
              <p className="text-[11px] text-center text-gray-500 -mt-1">
                Copies UPI ID + opens GPay (payee + amount only). If it errors, paste UPI in Send money.
              </p>

              <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
                <h4 className="text-sm font-bold text-gray-900 mb-1">Or choose another app</h4>
                <p className="text-xs text-gray-500 mb-3">
                  PhonePe, Paytm, BHIM, WhatsApp Pay, or Other UPI
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {UPI_PAYMENT_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handlePayWithApp(app)}
                      disabled={!!paymentBuild.error}
                      className={`min-h-[48px] rounded-xl ${app.color} text-white text-sm font-bold active:opacity-90 disabled:bg-gray-300 disabled:text-gray-500`}
                    >
                      {app.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handlePayViaUpi}
                  disabled={!!paymentBuild.error}
                  className="w-full mt-2 min-h-[44px] rounded-xl border-2 border-green-600 text-green-700 text-sm font-semibold active:bg-green-50 disabled:opacity-50"
                >
                  Open system UPI chooser
                </button>
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

              <div className="bg-white rounded-2xl border border-blue-200 p-4 text-center">
                <h4 className="text-sm font-bold text-gray-900 mb-1">Scan QR Code</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Or tap below to open this QR payment in Google Pay (no scan)
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
                  onClick={handlePayViaGpayQr}
                  disabled={!!paymentBuild.error || !upiUri}
                  className="w-full mt-3 min-h-[48px] rounded-xl bg-[#1a73e8] text-white text-sm font-bold active:opacity-90 disabled:opacity-50"
                >
                  Open this QR payment in Google Pay
                </button>
                <button
                  type="button"
                  onClick={handleSaveQrToGallery}
                  disabled={!upiUri}
                  className={`w-full mt-2 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-50 ${
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
                <p className="font-semibold">Why GPay opens but payment fails</p>
                <p>
                  Our shop uses a <strong>personal UPI ID</strong>. GPay often rejects website
                  deep links for personal IDs, even when the ID is correct. Opening the app ≠
                  payment done.
                </p>
                <p>
                  <strong>Reliable method:</strong> Copy UPI ID → GPay → New payment / Send money
                  → paste → pay ₹{amount}.
                </p>
                <p>
                  Or scan the QR <strong>inside</strong> GPay (not only phone camera).
                </p>
                <p>
                  If you see &quot;bank limit&quot; — that is your bank, not this website. Try
                  another bank account linked in GPay.
                </p>
                <p>After you pay, enter UTR below.</p>
              </div>
            </div>
          )}

          {/* DESKTOP order: QR → UPI ID → Copy → Instructions */}
          {!isMobile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-5 text-center shadow-sm">
                <h4 className="text-lg font-bold text-gray-900 mb-1">Scan QR Code</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Scan with GPay on phone, or open the QR payment link on Android
                </p>
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
                  onClick={handlePayViaGpayQr}
                  disabled={!!paymentBuild.error || !upiUri}
                  className="w-full mt-3 min-h-[48px] rounded-xl bg-[#1a73e8] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  Pay ₹{amount} via QR in Google Pay
                </button>
                <button
                  type="button"
                  onClick={handleSaveQrToGallery}
                  disabled={!upiUri}
                  className={`w-full mt-2 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-50 ${
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
                  <p className="text-xs text-gray-500 mt-2">{merchantName}</p>
                  <p className="text-xs text-gray-500">Payment ref: {paymentRef}</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Choose payment app</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    On phone: tap an app. On desktop: scan QR with that app.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {UPI_PAYMENT_APPS.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handlePayWithApp(app)}
                        disabled={!!paymentBuild.error}
                        className={`min-h-[44px] rounded-xl ${app.color} text-white text-sm font-bold hover:opacity-90 disabled:bg-gray-300`}
                      >
                        {app.label}
                      </button>
                    ))}
                  </div>
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

                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">Why GPay may open but not pay</p>
                  <p>
                    Personal UPI IDs often reject website deep links. Reliable: Copy UPI ID or
                    scan QR inside GPay, then pay ₹{amount}.
                  </p>
                  <p>Enter UTR here after payment succeeds.</p>
                </div>
              </div>
            </div>
          )}

          {/* Pending confirmation — not verified PAID */}
          {isCheckoutFlow && (
            <div className="bg-white/90 rounded-2xl p-4 sm:p-6 border border-gray-200">
              <h4 className="text-base font-bold text-gray-900 mb-1">After you pay</h4>
              <p className="text-sm text-gray-600 mb-3">
                Enter the UTR / transaction ID from your UPI app, then submit your order.
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
                    ? 'bg-green-600 text-white active:bg-green-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Submit order
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
