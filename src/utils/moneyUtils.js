/**
 * Canonical money helpers for PR Nexus FishMart.
 *
 * Internal unit: integer paise (1 ₹ = 100 paise).
 * Display / UPI: rupees with exactly 2 decimal places.
 *
 * Quantity policy (fish by weight): positive multiples of 0.5 kg.
 * Line total (paise): Math.round(ratePaise * halfKgSteps / 2)
 *
 * NOTE: Does not import quantityUtils (avoids circular deps).
 * Callers should pass normalizeQuantity() results for cart totals.
 */

const QTY_MIN = 0.5;
const QTY_MAX = 200;
const QTY_STEP = 0.5;

/** Convert rupees → integer paise (nearest paise). Non-finite / ≤0 → 0. */
export const toPaise = (rupees) => {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
};

/** Convert integer paise → rupees number with cent precision. */
export const fromPaise = (paise) => {
  const p = Number(paise);
  if (!Number.isFinite(p)) return 0;
  return Math.round(p) / 100;
};

/** Format rupees for display / UPI (always 2 decimals). */
export const formatRupees = (rupees) => fromPaise(toPaise(rupees)).toFixed(2);

/** Format paise as rupee string with 2 decimals. */
export const formatPaiseAsRupees = (paise) => fromPaise(paise).toFixed(2);

/**
 * Number of 0.5 kg steps.
 * Uses same clamp/step rules as quantityUtils without importing it.
 */
export const quantityToHalfKgSteps = (quantity) => {
  const numeric = parseFloat(quantity);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  const clamped = Math.min(QTY_MAX, Math.max(QTY_MIN, numeric));
  return Math.round(clamped / QTY_STEP);
};

/**
 * Line total in paise: (₹/kg) × kg via half-kg integer steps.
 */
export const lineTotalPaise = (unitPriceRupees, quantityKg) => {
  const ratePaise = toPaise(unitPriceRupees);
  if (ratePaise <= 0) return 0;
  const halfSteps = quantityToHalfKgSteps(quantityKg);
  if (halfSteps <= 0) return 0;
  return Math.round((ratePaise * halfSteps) / 2);
};

/** Line total in rupees (2 dp). */
export const lineTotalRupees = (unitPriceRupees, quantityKg) =>
  fromPaise(lineTotalPaise(unitPriceRupees, quantityKg));

/** Resolve unit price for a cart/product line: cart price wins, else rate. */
export const resolveUnitPrice = (item) => {
  const raw = item?.price ?? item?.rate ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Normalize category for offer matching (trim + lower-case). */
export const normalizeCategoryKey = (category) =>
  String(category ?? '')
    .trim()
    .toLowerCase();

/** Percentage of an amount in paise, rounded to nearest paise. */
export const percentageOfPaise = (basePaise, pct) => {
  const p = Number(pct);
  if (!Number.isFinite(p) || p <= 0 || basePaise <= 0) return 0;
  return Math.round((basePaise * p) / 100);
};

/** Clamp discount paise into [0, maxAllowed]. */
export const clampDiscountPaise = (discountPaise, maxAllowedPaise) => {
  const d = Math.max(0, Math.round(Number(discountPaise) || 0));
  const max = Math.max(0, Math.round(Number(maxAllowedPaise) || 0));
  return Math.min(d, max);
};

/** Final payable paise = max(0, subtotal - discount). */
export const payablePaise = (subtotalPaise, discountPaise) =>
  Math.max(0, Math.round(subtotalPaise) - Math.round(discountPaise));
