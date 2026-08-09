/**
 * Legacy Promotion Banner helpers — DISPLAY / marketing only.
 *
 * Financial cart unit price MUST be the catalog rate (fish.rate).
 * Customer discounts are applied ONLY by cartPricing.calculateCartSummary
 * (Offers XOR basket). Never write getPromotionalPrice() into cart.price.
 */

import { toPaise, fromPaise, percentageOfPaise } from './moneyUtils';

/** Catalog unit price used for cart / checkout financial calculations. */
export const getCatalogUnitPrice = (fish) => {
  const n = Number(fish?.rate);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return fromPaise(toPaise(n));
};

/**
 * Marketing promotional unit price for legacy banner UI.
 * Not authoritative for cart totals.
 */
export const getPromotionalPrice = (fish, promotions) => {
  const catalog = getCatalogUnitPrice(fish);
  if (!promotions || !promotions.isActive) {
    return catalog;
  }

  const isDiscounted =
    promotions.discountedFish && promotions.discountedFish.includes(fish.name);

  if (isDiscounted && promotions.discountPercentage && promotions.discountPercentage > 0) {
    const ratePaise = toPaise(catalog);
    const discountPaise = percentageOfPaise(ratePaise, promotions.discountPercentage);
    return fromPaise(Math.max(0, ratePaise - discountPaise));
  }

  return catalog;
};

/**
 * Display helpers for product cards / banners.
 * `catalogPrice` is the financial unit price (matches cart).
 * `promotionalPrice` is marketing-only when a legacy banner promo applies.
 */
export const getDisplayPrice = (fish, promotions) => {
  const catalogPrice = getCatalogUnitPrice(fish);
  const promotionalPrice = getPromotionalPrice(fish, promotions);
  const isDiscounted = promotionalPrice < catalogPrice;

  return {
    /** Financial unit price — same as cart line unit price */
    currentPrice: catalogPrice,
    catalogPrice,
    promotionalPrice,
    originalPrice: catalogPrice,
    isDiscounted,
    discountPercentage: isDiscounted ? promotions?.discountPercentage || 0 : 0,
  };
};

export const formatPrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(0);
};
