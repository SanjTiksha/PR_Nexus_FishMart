/**
 * Canonical cart / offer / basket pricing for PR Nexus FishMart.
 *
 * ALL money paths (cart, checkout, payment session) must use calculateCartSummary.
 * Arithmetic uses integer paise via moneyUtils.
 *
 * Discount rule (no stacking):
 * 1) Best single active offer (type priority, then larger discount)
 * 2) Else legacy basket % discount (discountSettings)
 * Never both.
 */

import { QUANTITY_LIMITS, normalizeQuantity } from './quantityUtils';
import {
  toPaise,
  fromPaise,
  lineTotalPaise,
  resolveUnitPrice,
  normalizeCategoryKey,
  percentageOfPaise,
  clampDiscountPaise,
  payablePaise,
} from './moneyUtils';
import {
  isOfferActive,
  getOfferTypeMeta,
} from './offerUtils';

export const DEFAULT_DISCOUNT_SETTINGS = {
  isEnabled: true,
  percentage: 5,
  minimumAmount: 1000,
};

const sanitizeCartItems = (cartItems = []) =>
  (Array.isArray(cartItems) ? cartItems : []).map((item) => {
    const quantity = normalizeQuantity(item?.quantity ?? QUANTITY_LIMITS.MIN);
    const unitPrice = resolveUnitPrice(item);
    const linePaise = lineTotalPaise(unitPrice, quantity);
    return {
      ...item,
      quantity,
      price: unitPrice,
      rate: item?.rate ?? unitPrice,
      lineTotalPaise: linePaise,
      lineTotal: fromPaise(linePaise),
    };
  });

export const sumLinePaise = (items = []) =>
  items.reduce((sum, item) => sum + (item.lineTotalPaise || 0), 0);

export const getEligibleSubtotalPaise = (items = [], offer) => {
  if (!offer || offer.applyTo === 'entire_store') {
    return sumLinePaise(items);
  }

  if (offer.applyTo === 'selected_products') {
    const ids = new Set((offer.productIds || []).map((id) => String(id)));
    return items
      .filter((item) => ids.has(String(item.id)))
      .reduce((sum, item) => sum + (item.lineTotalPaise || 0), 0);
  }

  if (offer.applyTo === 'selected_categories') {
    const cats = new Set(
      (offer.categoryIds || []).map((c) => normalizeCategoryKey(c)),
    );
    return items
      .filter((item) => cats.has(normalizeCategoryKey(item.category)))
      .reduce((sum, item) => sum + (item.lineTotalPaise || 0), 0);
  }

  return 0;
};

/**
 * Discount for one offer in paise. Caps at eligible, maxDiscount, and never negative.
 */
export const calculateOfferDiscountPaise = (items, offer, now = new Date()) => {
  if (!isOfferActive(offer, now)) {
    return { discountPaise: 0, eligiblePaise: 0 };
  }

  const subtotalPaise = sumLinePaise(items);
  const minOrderPaise = toPaise(offer.minimumOrderAmount);
  if (minOrderPaise > 0 && subtotalPaise < minOrderPaise) {
    return { discountPaise: 0, eligiblePaise: 0 };
  }

  const eligiblePaise = getEligibleSubtotalPaise(items, offer);
  if (eligiblePaise <= 0) {
    return { discountPaise: 0, eligiblePaise: 0 };
  }

  let discountPaise = 0;
  if (offer.discountType === 'fixed') {
    discountPaise = toPaise(offer.discountValue);
  } else {
    discountPaise = percentageOfPaise(eligiblePaise, offer.discountValue);
  }

  const maxCap = toPaise(offer.maximumDiscount);
  if (maxCap > 0) {
    discountPaise = Math.min(discountPaise, maxCap);
  }

  discountPaise = clampDiscountPaise(discountPaise, eligiblePaise);
  return { discountPaise, eligiblePaise };
};

/**
 * Best single offer: type priority first, then larger discount. No stacking.
 */
export const getBestOfferForCart = (items, offers = [], now = new Date()) => {
  const candidates = [];

  for (const offer of Array.isArray(offers) ? offers : []) {
    const { discountPaise } = calculateOfferDiscountPaise(items, offer, now);
    if (discountPaise > 0) {
      candidates.push({
        offer,
        discountPaise,
        priority: getOfferTypeMeta(offer.type).priority,
      });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.discountPaise - a.discountPaise;
  });

  return candidates[0];
};

/**
 * Canonical cart summary — sole source for cart / checkout / payment amounts.
 */
export const calculateCartSummary = (
  cartItems = [],
  discountSettings = DEFAULT_DISCOUNT_SETTINGS,
  offers = [],
  now = new Date(),
) => {
  const items = sanitizeCartItems(cartItems);
  const subtotalPaise = sumLinePaise(items);

  const best = getBestOfferForCart(items, offers, now);

  let discountPaise = 0;
  let appliedOffer = null;
  let discountSource = 'none';

  if (best?.discountPaise > 0) {
    discountPaise = best.discountPaise;
    appliedOffer = best.offer;
    discountSource = 'offer';
  } else if (discountSettings?.isEnabled) {
    const minBasketPaise = toPaise(discountSettings.minimumAmount);
    if (subtotalPaise >= minBasketPaise && subtotalPaise > 0) {
      discountPaise = percentageOfPaise(
        subtotalPaise,
        discountSettings.percentage,
      );
      discountSource = 'basket';
    }
  }

  discountPaise = clampDiscountPaise(discountPaise, subtotalPaise);
  const totalPaise = payablePaise(subtotalPaise, discountPaise);

  const subtotal = fromPaise(subtotalPaise);
  const discount = fromPaise(discountPaise);
  const total = fromPaise(totalPaise);

  // Hard financial invariants
  if (
    !Number.isFinite(subtotal) ||
    !Number.isFinite(discount) ||
    !Number.isFinite(total) ||
    discount < 0 ||
    total < 0 ||
    discount > subtotal + 1e-9 ||
    total > subtotal + 1e-9
  ) {
    console.error('[cartPricing] Invalid money result', {
      subtotalPaise,
      discountPaise,
      totalPaise,
    });
    return {
      items,
      subtotal: fromPaise(subtotalPaise),
      discount: 0,
      total: fromPaise(subtotalPaise),
      subtotalPaise,
      discountPaise: 0,
      totalPaise: subtotalPaise,
      appliedOffer: null,
      discountSource: 'none',
      offerId: null,
      offerName: null,
    };
  }

  return {
    items,
    subtotal,
    discount,
    total,
    subtotalPaise,
    discountPaise,
    totalPaise,
    appliedOffer,
    discountSource,
    offerId: appliedOffer?.id || null,
    offerName: appliedOffer?.title || null,
  };
};

/** Alias kept for older imports. */
export const summarizeCartWithOffers = calculateCartSummary;
