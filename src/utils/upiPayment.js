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
 * Same URI shape for all merchants (including Paytm @ptys / @paytm).
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
  const tn = String(paymentRef || createPaymentReference()).trim();

  if (!pa || !pa.includes('@')) {
    return { error: 'Merchant UPI ID is missing or invalid.' };
  }
  if (!am) {
    return { error: 'Order amount is invalid.' };
  }

  // Standard UPI params for ALL merchants (including Paytm-style)
  const params = { pa, pn, am, cu: 'INR', tn };

  // Values encoded with encodeURIComponent — @ becomes %40 (correct)
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const upiUri = `upi://pay?${query}`;

  // Kept for API compatibility only — launchUpiPayment must NOT use this as primary
  const intentUri = `intent://pay?${query}#Intent;scheme=upi;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

  if (import.meta.env.DEV) {
    console.log('[UPI] merchantUpiId:', merchantUpiId);
    console.log('[UPI] upiUri:', upiUri);
    console.log('[UPI] params:', params);
  }

  return { upiUri, intentUri, params, amount: am, paymentRef: tn };
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
    tn: params?.tn,
    pn: params?.pn,
    // pa shown as configured merchant id (public)
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
 * Does NOT use intent:// as the primary launch mechanism.
 * Opening UPI is not payment confirmation.
 * Signature kept compatible: intentUri / isAndroid accepted but unused for launch.
 */
export const launchUpiPayment = ({ upiUri, intentUri: _intentUri, isIOS, isAndroid: _isAndroid }) => {
  const fallbackMessage =
    'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.';

  if (!upiUri) {
    return {
      launched: false,
      method: 'none',
      message: fallbackMessage,
    };
  }

  if (import.meta.env.DEV) {
    console.log('[UPI] launch upiUri:', upiUri);
  }

  try {
    // Primary launch for Android, iOS, and desktop: navigate to standard upi:// URI
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
