/**
 * UPI payment helpers for PR Nexus FishMart.
 * Builds NPCI-style upi://pay URIs and device detection for Android / iOS / desktop.
 */

export const createPaymentReference = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRN${stamp}${rand}`;
};

export const formatUpiAmount = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num.toFixed(2);
};

/** Fixed transaction purpose note (URL-encoded in the deep link). */
export const UPI_TRANSACTION_NOTE = 'Fish Mart Order';

/**
 * Build a Personal (P2P) UPI deep link for checkout.
 *
 * Omits merchant-only fields (mc, orgid, sign) so GPay treats this as a
 * peer-to-peer transfer, not an unverified merchant intent.
 *
 * Encoding rules:
 * - pa: literal '@' (NOT %40)
 * - pn / tn: URL-encoded
 * - tr: unique per-checkout alphanumeric reference
 * - no mc / orgid / sign
 *
 * @returns {{ upiUri: string, params: Record<string,string>, amount: string, paymentRef: string } | { error: string }}
 */
export const buildUpiPayment = ({
  merchantUpiId,
  merchantName = 'PR Nexus FishMart',
  amount,
  paymentRef,
}) => {
  const pa = String(merchantUpiId || '').trim();
  const pn = String(merchantName || 'PR Nexus FishMart').trim();
  const am = formatUpiAmount(amount);
  const tr = String(paymentRef || createPaymentReference()).trim();
  const tn = UPI_TRANSACTION_NOTE;

  if (!pa || !pa.includes('@') || !/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/.test(pa)) {
    return { error: 'Payee UPI ID is missing or invalid.' };
  }
  // Reject Paytm merchant QR VPAs for this P2P flow
  if (/^paytmqr/i.test(pa) || /@(ptys)\b/i.test(pa)) {
    return { error: 'Use a personal UPI ID (e.g. name@okicici), not a merchant QR VPA.' };
  }
  if (!am || Number(am) <= 0) {
    return { error: 'Invalid payment amount.' };
  }
  if (!tr || !/^[A-Za-z0-9]+$/.test(tr)) {
    return { error: 'Payment reference is missing or invalid.' };
  }

  // Personal P2P params only — never include mc / orgid / sign
  const params = {
    pa,
    pn,
    tr,
    tn,
    am,
    cu: 'INR',
  };

  const upiUri =
    `upi://pay?pa=${pa}` +
    `&pn=${encodeURIComponent(pn)}` +
    `&tr=${tr}` +
    `&tn=${encodeURIComponent(tn)}` +
    `&am=${am}` +
    `&cu=INR`;

  if (import.meta.env.DEV) {
    console.log('[UPI] payee:', pa);
    console.log('[UPI] amount:', am);
    console.log('[UPI] paymentRef:', tr);
    console.log('[UPI] params:', params);
    console.log('[UPI] upiUri:', upiUri);
  }

  return {
    upiUri,
    params,
    amount: am,
    paymentRef: tr,
  };
};

export const detectPaymentDevice = () => {
  if (typeof navigator === 'undefined') {
    return { isMobile: false, isIOS: false, isAndroid: false };
  }
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile =
    isIOS ||
    isAndroid ||
    window.innerWidth < 768 ||
    /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  return { isMobile, isIOS, isAndroid };
};

/** Safe console logging — no secrets beyond public UPI merchant id */
export const logPaymentAttempt = ({
  orderId,
  paymentRef,
  amount,
  merchantUpiId,
  params,
}) => {
  console.info('[UPI Payment]', {
    orderId,
    paymentRef,
    amount,
    merchantUpiId,
    cu: params?.cu,
    tr: params?.tr,
    tn: params?.tn,
    pn: params?.pn,
    pa: merchantUpiId,
  });
};

export const copyTextToClipboard = async (text) => {
  const value = String(text || '');
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
};

/**
 * Platform-specific UPI launch (standard upi:// only — no intent://).
 * Opening a UPI app is NOT payment confirmation.
 */
export const launchUpiPayment = ({ upiUri, intentUri: _intentUri, isIOS, isAndroid }) => {
  const fallbackMessage =
    'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.';

  if (!upiUri || !upiUri.startsWith('upi://pay?')) {
    return { launched: false, method: 'none', message: fallbackMessage };
  }

  // Desktop: prefer QR / Copy UPI — do not assume a UPI app exists
  if (!isIOS && !isAndroid) {
    return {
      launched: false,
      method: 'desktop',
      message:
        'On desktop, please scan the QR code or copy the UPI ID to pay from your phone.',
    };
  }

  if (import.meta.env.DEV) {
    console.log('[UPI] launch platform:', isIOS ? 'ios' : 'android', 'upiUri:', upiUri);
  }

  try {
    // Android + iOS: hand off to OS UPI handler (GPay / PhonePe / Paytm chooser)
    window.location.href = upiUri;

    return {
      launched: true,
      method: isIOS ? 'upi-uri-ios' : 'upi-uri-android',
      message: isIOS
        ? 'If payment did not open, copy the UPI ID or scan the QR code in your UPI app.'
        : 'UPI app opened. Complete payment there. Opening the app is not payment confirmation.',
    };
  } catch {
    return { launched: false, method: 'none', message: fallbackMessage };
  }
};
