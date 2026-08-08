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
 * @returns {{ upiUri: string, params: Record<string,string>, amount: string } | { error: string }}
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

  if (!pa || !pa.includes('@')) {
    return { error: 'Merchant UPI ID is missing or invalid.' };
  }
  if (!am) {
    return { error: 'Order amount is invalid.' };
  }

  // Paytm QR / merchant VPA (@ptys, @paytm) often reject UPI "tn" (description)
  // and show "Can't add description". Keep paymentRef only in our app/order.
  const isPaytmStyleMerchant = /@(ptys|paytm)\b/i.test(pa);

  // URI params sent to UPI apps / QR (no tn for Paytm-style merchants)
  const params = isPaytmStyleMerchant
    ? { pa, pn, am, cu: 'INR' }
    : { pa, pn, am, cu: 'INR', tn: ref };

  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const upiUri = `upi://pay?${query}`;

  // Android Chrome app-chooser intent (lets user pick any installed UPI app)
  const intentUri = `intent://pay?${query}#Intent;scheme=upi;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

  return { upiUri, intentUri, params, amount: am, paymentRef: ref };
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
 * Launch UPI app. Returns { launched: boolean, method: string, message?: string }
 */
export const launchUpiPayment = ({ upiUri, intentUri, isIOS, isAndroid }) => {
  if (!upiUri) {
    return {
      launched: false,
      method: 'none',
      message:
        'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.',
    };
  }

  // iOS Safari: deep links are unreliable — caller should prefer QR / copy
  if (isIOS) {
    try {
      window.location.href = upiUri;
      return {
        launched: true,
        method: 'upi-uri-ios',
        message:
          'If payment did not open, copy the UPI ID or scan the QR code in PhonePe / Google Pay.',
      };
    } catch {
      return {
        launched: false,
        method: 'upi-uri-ios',
        message:
          'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.',
      };
    }
  }

  try {
    const target = isAndroid && intentUri ? intentUri : upiUri;
    const anchor = document.createElement('a');
    anchor.href = target;
    anchor.style.display = 'none';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return { launched: true, method: isAndroid ? 'android-intent' : 'upi-uri' };
  } catch {
    try {
      window.location.href = upiUri;
      return { launched: true, method: 'location-href' };
    } catch {
      return {
        launched: false,
        method: 'none',
        message:
          'Unable to open your UPI app. You can copy the UPI ID or scan the QR code to complete payment.',
      };
    }
  }
};
