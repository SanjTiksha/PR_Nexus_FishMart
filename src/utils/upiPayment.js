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

/**
 * Build a standard UPI pay URI from a locked payment session.
 * Same parameter structure for ALL merchants (including Paytm @ptys).
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
  const ref = String(paymentRef || createPaymentReference()).trim();

  // Keep { error } return shape for QRModal compatibility (do not throw)
  if (!pa || !pa.includes('@')) {
    return { error: 'Merchant UPI ID is missing or invalid.' };
  }
  if (!am || Number(am) <= 0) {
    return { error: 'Invalid payment amount.' };
  }
  if (!ref) {
    return { error: 'Payment reference is missing.' };
  }

  // Paytm merchant QR VPAs (@ptys / @paytm) reject UPI note/reference fields.
  // GPay shows: "Can't add description" → then "Invalid UPI".
  // Paste-only works because no tn/tr is sent. Keep ref in our app only.
  const isPaytmMerchantQr = /@(ptys|paytm)\b/i.test(pa);

  const params = isPaytmMerchantQr
    ? { pa, pn, am, cu: 'INR' }
    : { pa, pn, tr: ref, tn: ref, am, cu: 'INR' };

  // encodeURIComponent is correct (@ → %40, spaces → %20)
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const upiUri = `upi://pay?${query}`;

  if (import.meta.env.DEV) {
    console.log('[UPI] merchant:', pa);
    console.log('[UPI] amount:', am);
    console.log('[UPI] paymentRef:', ref);
    console.log('[UPI] params:', params);
    console.log('[UPI] upiUri:', upiUri);
  }

  return {
    upiUri,
    params,
    amount: am,
    paymentRef: ref,
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
 * Launch UPI app via standard upi:// URI only.
 * Does NOT use intent:// as the primary (or any) launch mechanism.
 * Opening UPI is not payment confirmation.
 * Signature kept compatible: intentUri accepted but unused.
 */
export const launchUpiPayment = ({ upiUri, intentUri: _intentUri, isIOS, isAndroid }) => {
  const fallbackMessage =
    'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.';

  if (!upiUri) {
    return {
      launched: false,
      method: 'none',
      message: fallbackMessage,
    };
  }

  // Desktop: do not assume a UPI app exists — use QR / Copy UPI ID
  if (!isIOS && !isAndroid) {
    return {
      launched: false,
      method: 'desktop',
      message:
        'On desktop, please scan the QR code or copy the UPI ID to pay from your phone.',
    };
  }

  if (import.meta.env.DEV) {
    console.log('[UPI] launch upiUri:', upiUri);
  }

  try {
    // Android + iPhone: navigate to standard upi:// URI (OS picks installed UPI app)
    window.location.href = upiUri;

    if (isIOS) {
      return {
        launched: true,
        method: 'upi-uri',
        message:
          'If payment did not open, copy the UPI ID or scan the QR code in PhonePe / Google Pay.',
      };
    }

    return {
      launched: true,
      method: 'upi-uri',
      message:
        'UPI app opened. Complete payment there. Opening the app is not payment confirmation.',
    };
  } catch {
    return {
      launched: false,
      method: 'none',
      message: fallbackMessage,
    };
  }
};
