/**
 * Historical order financial breakdown from the order/payment snapshot.
 * Never recalculate using current promotion or offer settings.
 */

import { fromPaise, toPaise } from './moneyUtils';

const toMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return fromPaise(toPaise(n));
};

/**
 * @param {object} order - Stored order snapshot
 * @returns {{ subtotal: number, discount: number, deliveryCharge: number, total: number, offerName: string|null, offerId: string|null, discountSource: string|null, hasSnapshot: boolean }}
 */
export const getOrderFinancialBreakdown = (order) => {
  if (!order || typeof order !== 'object') {
    return {
      subtotal: 0,
      discount: 0,
      deliveryCharge: 0,
      total: 0,
      offerName: null,
      offerId: null,
      discountSource: null,
      hasSnapshot: false,
    };
  }

  const total = toMoney(order.totalPrice) ?? 0;
  const subtotalSnap = toMoney(order.subtotal);
  const discountSnap = toMoney(order.discount);

  // Prefer explicit snapshot fields written at checkout/payment lock time.
  const hasSnapshot = subtotalSnap != null && discountSnap != null;

  const subtotal = hasSnapshot ? subtotalSnap : total;
  const discount = hasSnapshot ? discountSnap : 0;
  const deliveryCharge = toMoney(order.deliveryCharge) ?? 0;

  return {
    subtotal,
    discount,
    deliveryCharge,
    total,
    offerName: order.offerName || null,
    offerId: order.offerId || null,
    discountSource: order.discountSource || null,
    hasSnapshot,
  };
};

export const formatOrderDiscountLabel = (breakdown) => {
  if (!breakdown || !(breakdown.discount > 0)) return 'Discount';
  if (breakdown.offerName) return breakdown.offerName;
  if (breakdown.discountSource === 'basket') return 'Basket discount';
  return 'Discount';
};
