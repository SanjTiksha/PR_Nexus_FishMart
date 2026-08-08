/**
 * Merchant payment configuration.
 * Prefer Vite env vars; fall back to shop settings from Firestore/local data.
 * UPI IDs are public by design (shown on invoices/QR) — not secret API keys.
 */

export const PAYMENT_MERCHANT_NAME =
  import.meta.env.VITE_PAYMENT_MERCHANT_NAME || 'PR Nexus FishMart';

export const PAYMENT_UPI_ID_ENV = import.meta.env.VITE_PAYMENT_UPI_ID || '';

export const resolveMerchantUpiId = (shopInfo = {}) => {
  const fromEnv = String(PAYMENT_UPI_ID_ENV || '').trim();
  if (fromEnv) return fromEnv;
  return String(shopInfo.upiId || '').trim();
};

export const resolveMerchantName = (shopInfo = {}) => {
  return String(shopInfo.name || PAYMENT_MERCHANT_NAME || 'PR Nexus FishMart').trim();
};
