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
  // Always 2 decimals (5.00) — banks/GPay accept this more reliably than bare "5"
  return num.toFixed(2);
};

/** Google Pay Android package — used to open GPay directly. */
export const GPAY_ANDROID_PACKAGE = 'com.google.android.apps.nbu.paisa.user';

/**
 * Personal P2P links for GPay / PhonePe / Paytm / BHIM.
 *
 * WHY GPay "opens but fails":
 * Personal UPI IDs (name@okicici, mobile@ybl) are P2P. When the link includes
 * merchant-style fields (pn, tr, tn, mc, cu), GPay often rejects with
 * "Invalid UPI" / description errors even though Copy+Send money works.
 *
 * FIX: GPay / QR use ONLY pa + am (true P2P). Order ref stays on our page, not in the UPI link.
 */
export const buildUpiAppLinks = (params = {}) => {
  const pa = String(params.pa || '').trim();
  const am = String(params.am || '').trim();

  // Minimal P2P query — literal @ in pa (matches successful manual Send money)
  const p2pQuery = `pa=${pa}&am=${am}`;
  const upiUri = `upi://pay?${p2pQuery}`;

  // Encoded pa for some custom schemes
  const encodedP2p = `pa=${encodeURIComponent(pa)}&am=${encodeURIComponent(am)}`;

  // Android: open GPay package with the same minimal P2P payload
  const gpayIntent =
    `intent://pay?${p2pQuery}` +
    `#Intent;scheme=upi;package=${GPAY_ANDROID_PACKAGE};end`;

  return {
    upi: upiUri,
    gpayIntent,
    gpay: `gpay://upi/pay?${encodedP2p}`,
    tez: `tez://upi/pay?${encodedP2p}`,
    phonepe: `phonepe://pay?${encodedP2p}`,
    paytm: `paytmmp://pay?${encodedP2p}`,
    bhim: `bhim://upi/pay?${encodedP2p}`,
    whatsapp: upiUri,
  };
};

/**
 * Build a Personal (P2P) UPI payment for checkout.
 *
 * UPI / QR / GPay link: upi://pay?pa=...&am=...
 * (no pn/tr/tn/cu/mc — those break GPay on personal VPAs)
 *
 * paymentRef is kept for our order tracking only (shown on screen + UTR claim).
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

  // params kept for logging / UI; UPI wire format is pa+am only
  const params = { pa, pn, tr, am };

  const upiUri = `upi://pay?pa=${pa}&am=${am}`;
  const appLinks = buildUpiAppLinks(params);

  if (import.meta.env.DEV) {
    console.log('[UPI] mode: personal P2P (pa+am only)');
    console.log('[UPI] payee:', pa);
    console.log('[UPI] amount:', am);
    console.log('[UPI] paymentRef (not in UPI link):', tr);
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
        'UPI app opening (P2P: payee + amount only). Confirm with UPI PIN, then enter UTR here.',
    };
  } catch {
    return { launched: false, message: fallbackMessage };
  }
};

/**
 * Open Google Pay with minimal P2P payload (pa + am) — same as QR.
 * Also expects caller to copy UPI ID so user can paste if GPay still rejects the link.
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

  // Prefer minimal upi:// into GPay package (most P2P-friendly). Then gpay:// / tez.
  const primaryUrl = isAndroid
    ? appLinks.gpayIntent || appLinks.upi
    : appLinks.upi;

  return launchSpecificUpiApp({
    primaryUrl,
    fallbackUrl: isAndroid ? appLinks.gpay : appLinks.gpay,
    extraFallbacks: isAndroid ? [appLinks.tez, appLinks.upi] : [appLinks.gpay],
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
