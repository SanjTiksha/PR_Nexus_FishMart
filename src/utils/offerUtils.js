/**
 * Offers & Promotions helpers (status, applicability display, product badges).
 * Cart money totals live in cartPricing.js (canonical).
 */

import {
  toPaise,
  fromPaise,
  lineTotalPaise,
  resolveUnitPrice,
  normalizeCategoryKey,
  percentageOfPaise,
  clampDiscountPaise,
} from './moneyUtils';

export const OFFER_TYPES = [
  { id: 'flash', label: 'Flash Offer', priority: 1 },
  { id: 'festival', label: 'Festival Offer', priority: 2 },
  { id: 'promotional', label: 'Promotional Offer', priority: 3 },
  { id: 'website_launch', label: 'Website Launch Offer', priority: 4 },
  { id: 'weekend', label: 'Weekend Offer', priority: 5 },
  { id: 'general', label: 'General Offer', priority: 6 },
];

export const APPLY_TO_OPTIONS = [
  { id: 'entire_store', label: 'Entire Store' },
  { id: 'selected_products', label: 'Selected Products' },
  { id: 'selected_categories', label: 'Selected Categories' },
];

export const FISH_CATEGORIES = ['Seawater', 'Freshwater'];

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Combine date (YYYY-MM-DD) + time (HH:mm) into local Date */
export const combineOfferDateTime = (dateStr, timeStr, endOfDay = false) => {
  const d = String(dateStr || '').trim();
  if (!d) return null;
  const t = String(timeStr || '').trim() || (endOfDay ? '23:59' : '00:00');
  const parsed = new Date(`${d}T${t}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getOfferTypeMeta = (typeId) =>
  OFFER_TYPES.find((t) => t.id === typeId) || {
    id: typeId,
    label: typeId || 'Offer',
    priority: 99,
  };

export const formatOfferDiscountLabel = (offer) => {
  if (!offer) return '';
  if (offer.discountType === 'fixed') {
    return `₹${toNumber(offer.discountValue).toFixed(0)} OFF`;
  }
  return `${toNumber(offer.discountValue).toFixed(0)}% OFF`;
};

export const getOfferWindow = (offer) => {
  const start = combineOfferDateTime(offer?.startDate, offer?.startTime, false);
  const end = combineOfferDateTime(offer?.endDate, offer?.endTime, true);
  return { start, end };
};

/**
 * Status derived from enabled + schedule.
 * Returns: draft | scheduled | active | expired | disabled
 */
export const getOfferStatus = (offer, now = new Date()) => {
  if (!offer) return 'disabled';
  if (offer.enabled === false) return 'disabled';

  const { start, end } = getOfferWindow(offer);
  if (!start || !end) return 'draft';
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';

  const maxUses = toNumber(offer.maxUses, 0);
  const usedCount = toNumber(offer.usedCount, 0);
  if (maxUses > 0 && usedCount >= maxUses) return 'expired';

  return 'active';
};

export const isOfferActive = (offer, now = new Date()) =>
  getOfferStatus(offer, now) === 'active';

export const getActiveOffers = (offers = [], now = new Date()) =>
  (Array.isArray(offers) ? offers : []).filter((o) => isOfferActive(o, now));

export const isProductInOffer = (offer, fish, now = new Date()) => {
  if (!isOfferActive(offer, now) || !fish) return false;
  if (offer.applyTo === 'entire_store') return true;
  if (offer.applyTo === 'selected_products') {
    return (offer.productIds || []).map(String).includes(String(fish.id));
  }
  if (offer.applyTo === 'selected_categories') {
    const fishCat = normalizeCategoryKey(fish.category);
    return (offer.categoryIds || [])
      .map((c) => normalizeCategoryKey(c))
      .includes(fishCat);
  }
  return false;
};

/** Best active offer badge for a single product (display only). */
export const getBestOfferForProduct = (fish, offers = [], now = new Date()) => {
  const active = getActiveOffers(offers, now).filter((o) =>
    isProductInOffer(o, fish, now),
  );
  if (!active.length) return null;

  active.sort((a, b) => {
    const pa = getOfferTypeMeta(a.type).priority;
    const pb = getOfferTypeMeta(b.type).priority;
    if (pa !== pb) return pa - pb;
    return toNumber(b.discountValue) - toNumber(a.discountValue);
  });

  return active[0];
};

/**
 * Estimated per-kg display price for product card (does not enforce cart min-order).
 * Uses paise rounding for consistency with cart engine.
 */
export const estimateProductOfferPrice = (fish, offer) => {
  if (!fish || !offer) return null;
  const ratePaise = toPaise(fish.rate);
  if (ratePaise <= 0) return null;

  let discountPaise = 0;
  if (offer.discountType === 'fixed') {
    discountPaise = toPaise(offer.discountValue);
  } else {
    discountPaise = percentageOfPaise(ratePaise, offer.discountValue);
  }
  const maxCap = toPaise(offer.maximumDiscount);
  if (maxCap > 0) discountPaise = Math.min(discountPaise, maxCap);
  discountPaise = clampDiscountPaise(discountPaise, ratePaise);
  return fromPaise(ratePaise - discountPaise);
};

export const countOffersByStatus = (offers = [], now = new Date()) => {
  const counts = { active: 0, scheduled: 0, expired: 0, disabled: 0, draft: 0 };
  for (const offer of Array.isArray(offers) ? offers : []) {
    const status = getOfferStatus(offer, now);
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
};

export const validateOfferForm = (form) => {
  const errors = [];
  if (!String(form.title || '').trim()) errors.push('Offer title is required.');
  if (!form.type) errors.push('Offer type is required.');
  if (!form.discountType) errors.push('Discount type is required.');
  if (!form.startDate) errors.push('Start date is required.');
  if (!form.endDate) errors.push('End date is required.');

  const value = toNumber(form.discountValue, NaN);
  if (!Number.isFinite(value) || value <= 0) {
    errors.push('Discount value must be greater than 0.');
  } else if (form.discountType === 'percentage' && value > 100) {
    errors.push('Percentage discount cannot exceed 100.');
  }

  const start = combineOfferDateTime(form.startDate, form.startTime, false);
  const end = combineOfferDateTime(form.endDate, form.endTime, true);
  if (start && end && end <= start) {
    errors.push('End date/time must be after start date/time.');
  }

  if (toNumber(form.minimumOrderAmount, 0) < 0) {
    errors.push('Minimum order amount cannot be negative.');
  }
  if (toNumber(form.maximumDiscount, 0) < 0) {
    errors.push('Maximum discount cannot be negative.');
  }
  if (form.maxUses !== '' && form.maxUses != null && toNumber(form.maxUses, 0) <= 0) {
    errors.push('Maximum uses must be greater than 0 if provided.');
  }

  if (form.applyTo === 'selected_products' && !(form.productIds || []).length) {
    errors.push('Select at least one product for this offer.');
  }
  if (form.applyTo === 'selected_categories' && !(form.categoryIds || []).length) {
    errors.push('Select at least one category for this offer.');
  }

  return errors;
};

// Re-export line helpers for any legacy display callers still using offerUtils path names
export const getCartSubtotal = (cartItems = []) =>
  fromPaise(
    (Array.isArray(cartItems) ? cartItems : []).reduce(
      (sum, item) => sum + lineTotalPaise(resolveUnitPrice(item), item?.quantity),
      0,
    ),
  );
