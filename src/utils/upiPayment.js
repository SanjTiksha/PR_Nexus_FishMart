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
  // Prefer compact amount (5 not 5.00) when whole; keep decimals when needed
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
};

/** Google Pay Android package — used to open GPay directly (same payload as QR). */
export const GPAY_ANDROID_PACKAGE = 'com.google.android.apps.nbu.paisa.user';

/**
 * App-specific UPI deep links so the user can open GPay / PhonePe / Paytm / BHIM directly.
 * WhatsApp Pay usually has no stable private scheme — falls back to generic upi://.
 *
 * gpayIntent = Android intent pinned to GPay with the SAME query string as the QR code.
 */
export const buildUpiAppLinks = (params = {}) => {
  const pa = String(params.pa || '').trim();
  const pn = String(params.pn || 'PR Nexus FishMart').trim();
  const am = String(params.am || '').trim();
  const tr = String(params.tr || '').trim();

  // App schemes often accept fully encoded query values (including pa @ → %40)
  const encodedQuery = [
    `pa=${encodeURIComponent(pa)}`,
    `pn=${encodeURIComponent(pn)}`,
    `am=${encodeURIComponent(am)}`,
    tr ? `tr=${encodeURIComponent(tr)}` : null,
    'cu=INR',
  ]
    .filter(Boolean)
    .join('&');

  // Generic upi:// keeps literal @ in pa (matches our QR / Pay via UPI format)
  const upiQuery = [
    `pa=${pa}`,
    `pn=${encodeURIComponent(pn)}`,
    tr ? `tr=${tr}` : null,
    `am=${am}`,
  ]
    .filter(Boolean)
    .join('&');

  const upiUri = `upi://pay?${upiQuery}`;

  // Same payment data as QR — opens Google Pay directly on Android (no scan needed)
  const gpayIntent =
    `intent://pay?${upiQuery}` +
    `#Intent;scheme=upi;package=${GPAY_ANDROID_PACKAGE};end`;

  return {
    upi: upiUri,
    gpayIntent,
    gpay: `gpay://upi/pay?${encodedQuery}`,
    tez: `tez://upi/pay?${encodedQuery}`,
    phonepe: `phonepe://pay?${encodedQuery}`,
    paytm: `paytmmp://pay?${encodedQuery}`,
    bhim: `bhim://upi/pay?${encodedQuery}`,
    // No reliable WhatsApp-Pay-only scheme; use UPI intent so WhatsApp can appear in chooser
    whatsapp: upiUri,
  };
};

/**
 * Build a Personal (P2P) UPI deep link for checkout.
 *
 * Format: upi://pay?pa=...&pn=...&tr=...&am=...
 * Omits tn, cu, mc, orgid, sign (GPay P2P-friendly).
 *
 * - pa: literal '@' (NOT %40)
 * - pn: URL-encoded
 * - tr: unique per-checkout reference
 * - am: dynamic order amount
 *
 * @returns {{ upiUri: string, params: Record<string,string>, appLinks: object, amount: string, paymentRef: string } | { error: string }}
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

  const params = { pa, pn, tr, am };

  const upiUri =
    `upi://pay?pa=${pa}` +
    `&pn=${encodeURIComponent(pn)}` +
    `&tr=${tr}` +
    `&am=${am}`;

  const appLinks = buildUpiAppLinks(params);

  if (import.meta.env.DEV) {
    console.log('[UPI] payee:', pa);
    console.log('[UPI] amount:', am);
    console.log('[UPI] paymentRef:', tr);
    console.log('[UPI] params:', params);
    console.log('[UPI] upiUri:', upiUri);
    console.log('[UPI] appLinks:', appLinks);
  }

  return {
    upiUri,
    params,
    appLinks,
    amount: am,
    paymentRef: tr,
  };
};

/** Payment apps shown on the checkout page (user picks one). */
export const UPI_PAYMENT_APPS = [
  {
    id: 'gpay',
    label: 'Google Pay',
    color: 'bg-[#1a73e8]',
    // Android: package-pinned intent (same data as QR). iOS/others: gpay:// then tez
    linkKey: 'gpayIntent',
    fallbackKey: 'gpay',
  },
  { id: 'phonepe', label: 'PhonePe', color: 'bg-[#5f259f]', linkKey: 'phonepe' },
  { id: 'paytm', label: 'Paytm', color: 'bg-[#00baf2]', linkKey: 'paytm' },
  { id: 'bhim', label: 'BHIM', color: 'bg-[#00afd5]', linkKey: 'bhim' },
  { id: 'whatsapp', label: 'WhatsApp Pay', color: 'bg-[#25D366]', linkKey: 'whatsapp' },
  { id: 'upi', label: 'Other UPI', color: 'bg-gray-800', linkKey: 'upi' },
];

const tryOpenUrl = (url) => {
  if (!url) return;
  try {
    window.location.href = url;
  } catch {
    /* ignore */
  }
};

/**
 * Open a specific UPI app link. Falls back to generic upi:// if needed.
 * Opening an app is NOT payment confirmation.
 */
export const launchSpecificUpiApp = ({ primaryUrl, fallbackUrl, extraFallbacks = [] }) => {
  const fallbackMessage =
    'Unable to open that UPI app. Try another app, copy the UPI ID, or scan the QR code.';

  if (!primaryUrl) {
    return { launched: false, message: fallbackMessage };
  }

  const chain = [primaryUrl, fallbackUrl, ...extraFallbacks].filter(
    (url, i, arr) => url && arr.indexOf(url) === i,
  );

  try {
    tryOpenUrl(chain[0]);

    // If page stays visible, app likely did not open — try next schemes
    chain.slice(1).forEach((url, index) => {
      setTimeout(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          tryOpenUrl(url);
        }
      }, 1100 * (index + 1));
    });

    return {
      launched: true,
      message:
        'Google Pay / UPI opening with your order amount (same as QR). Enter UPI PIN to finish, then enter UTR here.',
    };
  } catch {
    return { launched: false, message: fallbackMessage };
  }
};

/**
 * Open Google Pay with the exact same payment payload encoded in the QR.
 * Android uses package-pinned intent:// so GPay opens directly (no scan).
 * User must still confirm with UPI PIN — this site cannot auto-complete payment.
 */
export const launchGpayQrPayment = ({ appLinks, isAndroid, isIOS }) => {
  if (!appLinks?.upi) {
    return {
      launched: false,
      message: 'Payment link unavailable. Scan the QR code or copy the UPI ID.',
    };
  }

  if (!isAndroid && !isIOS) {
    return {
      launched: false,
      message: 'On desktop, scan the QR with Google Pay on your phone.',
    };
  }

  const primaryUrl = isAndroid
    ? appLinks.gpayIntent || appLinks.gpay || appLinks.upi
    : appLinks.gpay || appLinks.upi;

  return launchSpecificUpiApp({
    primaryUrl,
    fallbackUrl: isAndroid ? appLinks.gpay : appLinks.upi,
    extraFallbacks: isAndroid ? [appLinks.tez, appLinks.upi] : [appLinks.upi],
  });
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
