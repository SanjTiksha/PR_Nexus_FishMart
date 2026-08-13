/**
 * Temporary financial verification for paise-based cartPricing / moneyUtils.
 * Not a production test suite — delete after audit if desired.
 *
 * BUSINESS RULE — offer selection (cartPricing.getBestOfferForCart):
 * 1) Higher type priority wins (Flash=1 … General=6), even if a lower-priority
 *    offer has a larger monetary discount.
 * 2) Only when priorities tie does the larger discount win.
 * Legacy Promotion Banner never changes cart unit price; discounts apply only
 * via calculateCartSummary (offer XOR basket).
 */
import { lineTotalPaise, fromPaise, toPaise, lineTotalRupees, normalizeDeliveryChargeRupees, parseAdminDeliveryCharge } from '../src/utils/moneyUtils.js';
import { calculateCartSummary } from '../src/utils/cartPricing.js';
import { formatUpiAmount } from '../src/utils/upiPayment.js';
import { getCatalogUnitPrice, getPromotionalPrice } from '../src/utils/pricing.js';
import { getOrderFinancialBreakdown } from '../src/utils/orderFinancialDisplay.js';

const now = new Date('2026-08-15T12:00:00');
let passed = 0;
let failed = 0;
const failures = [];

const assert = (cond, label, detail = '') => {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failed += 1;
    const msg = `FAIL  ${label}${detail ? ` — ${detail}` : ''}`;
    failures.push(msg);
    console.error(msg);
  }
};

const baseOffer = (overrides = {}) => ({
  id: 'offer-1',
  title: 'Test Offer',
  type: 'general',
  enabled: true,
  discountType: 'percentage',
  discountValue: 10,
  minimumOrderAmount: 0,
  maximumDiscount: 0,
  applyTo: 'entire_store',
  productIds: [],
  categoryIds: [],
  startDate: '2026-08-01',
  startTime: '00:00',
  endDate: '2026-08-31',
  endTime: '23:59',
  maxUses: null,
  usedCount: 0,
  ...overrides,
});

const noBasket = { isEnabled: false, percentage: 0, minimumAmount: 0 };
const basket5 = { isEnabled: true, percentage: 5, minimumAmount: 1000 };

// 1–3 line totals
assert(lineTotalRupees(600, 0.5) === 300, '1) ₹600 × 0.5 kg = ₹300', `got ${lineTotalRupees(600, 0.5)}`);
assert(lineTotalRupees(600, 1) === 600, '2) ₹600 × 1 kg = ₹600', `got ${lineTotalRupees(600, 1)}`);
assert(lineTotalRupees(600, 1.5) === 900, '3) ₹600 × 1.5 kg = ₹900', `got ${lineTotalRupees(600, 1.5)}`);

// 4 multi-product subtotal
const multi = [
  { id: 'a', category: 'Seawater', price: 800, quantity: 0.5 },
  { id: 'b', category: 'Freshwater', price: 600, quantity: 1 },
  { id: 'c', category: 'Seawater', price: 1000, quantity: 0.5 },
];
const s4 = calculateCartSummary(multi, noBasket, [], now);
assert(s4.subtotal === 1500 && s4.total === 1500, '4) multi-product subtotal ₹1500', JSON.stringify(s4));

// 5 percentage
const s5 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10 })],
  now,
);
assert(
  s5.discount === 100 && s5.total === 900,
  '5) ₹1000 + 10% → discount ₹100, payable ₹900',
  JSON.stringify(s5),
);

// 6 max discount
const s6 = calculateCartSummary(
  [{ id: 1, price: 5000, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10, maximumDiscount: 200 })],
  now,
);
assert(
  s6.discount === 200 && s6.total === 4800,
  '6) ₹5000 + 10% capped ₹200 → payable ₹4800',
  JSON.stringify(s6),
);

// 7 fixed
const s7 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'fixed', discountValue: 150 })],
  now,
);
assert(s7.discount === 150 && s7.total === 850, '7) ₹1000 − ₹150 fixed → ₹850', JSON.stringify(s7));

// 8 fixed capped at subtotal
const s8 = calculateCartSummary(
  [{ id: 1, price: 100, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'fixed', discountValue: 150 })],
  now,
);
assert(s8.discount === 100 && s8.total === 0, '8) ₹100 − ₹150 fixed → discount ₹100, payable ₹0', JSON.stringify(s8));

// 9 min order blocks
const s9 = calculateCartSummary(
  [{ id: 1, price: 499, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10, minimumOrderAmount: 500 })],
  now,
);
assert(s9.discount === 0 && s9.total === 499, '9) ₹499 < min ₹500 → no discount', JSON.stringify(s9));

// 10 min order allows
const s10 = calculateCartSummary(
  [{ id: 1, price: 500, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10, minimumOrderAmount: 500 })],
  now,
);
assert(s10.discount === 50 && s10.total === 450, '10) ₹500 meets min → 10% applies', JSON.stringify(s10));

// 11 selected products only
const s11 = calculateCartSummary(
  multi,
  noBasket,
  [baseOffer({
    applyTo: 'selected_products',
    productIds: ['a', 'c'],
    discountType: 'percentage',
    discountValue: 10,
  })],
  now,
);
// eligible = 400 + 500 = 900 → 90
assert(s11.discount === 90 && s11.total === 1410, '11) selected products only (eligible ₹900 → ₹90)', JSON.stringify(s11));

// 12 selected categories (case-insensitive)
const s12 = calculateCartSummary(
  multi,
  noBasket,
  [baseOffer({
    applyTo: 'selected_categories',
    categoryIds: ['seawater'],
    discountType: 'percentage',
    discountValue: 10,
  })],
  now,
);
// seawater A+C = 900 → 90
assert(s12.discount === 90 && s12.total === 1410, '12) selected categories only (Seawater)', JSON.stringify(s12));

// 13 expired
const s13 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [baseOffer({ endDate: '2026-08-01', endTime: '00:00' })],
  now,
);
assert(s13.discount === 0 && s13.total === 1000, '13) expired offer → no discount', JSON.stringify(s13));

// 14 disabled
const s14 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [baseOffer({ enabled: false })],
  now,
);
assert(s14.discount === 0 && s14.total === 1000, '14) disabled offer → no discount', JSON.stringify(s14));

// 15 two offers — same priority, larger discount wins
// Use two general offers so priority ties; B has larger discount
const offerA = baseOffer({
  id: 'A',
  type: 'general',
  discountType: 'fixed',
  discountValue: 100,
});
const offerB = baseOffer({
  id: 'B',
  type: 'general',
  discountType: 'fixed',
  discountValue: 150,
});
const s15 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [offerA, offerB],
  now,
);
assert(
  s15.discount === 150 && s15.total === 850 && s15.offerId === 'B',
  '15) best of ₹100 vs ₹150 → ₹150 only',
  JSON.stringify(s15),
);

// 16 offer + basket never stack
const s16 = calculateCartSummary(
  [{ id: 1, price: 2000, quantity: 1 }],
  basket5, // would be ₹100 if used alone
  [baseOffer({ discountType: 'percentage', discountValue: 10 })], // ₹200
  now,
);
assert(
  s16.discountSource === 'offer' && s16.discount === 200 && s16.total === 1800,
  '16) offer + basket NEVER stack (offer wins)',
  JSON.stringify(s16),
);
const s16b = calculateCartSummary(
  [{ id: 1, price: 2000, quantity: 1 }],
  basket5,
  [], // no offers → basket alone
  now,
);
assert(
  s16b.discountSource === 'basket' && s16b.discount === 100 && s16b.total === 1900,
  '16b) basket alone when no offer',
  JSON.stringify(s16b),
);

// 17 invalid inputs must not yield NaN/Infinity/negative payable
const invalidCases = [
  { id: 1, price: NaN, quantity: 1 },
  { id: 2, price: Infinity, quantity: 1 },
  { id: 3, price: -100, quantity: 1 },
  { id: 4, price: 0, quantity: 1 },
  { id: 5, price: 'abc', quantity: 1 },
  { id: 6, price: 100, quantity: NaN },
  { id: 7, price: 100, quantity: -1 },
  { id: 8, price: 100, quantity: 0 },
  { id: 9, price: 100, quantity: 'xyz' },
];
const s17 = calculateCartSummary(invalidCases, noBasket, [], now);
assert(
  Number.isFinite(s17.total) &&
    Number.isFinite(s17.subtotal) &&
    Number.isFinite(s17.discount) &&
    s17.total >= 0 &&
    s17.discount >= 0 &&
    s17.discount <= s17.subtotal &&
    !Number.isNaN(s17.total),
  '17) invalid price/qty → finite non-negative payable',
  JSON.stringify(s17),
);

// 18–20 payment lock simulation (same as App.jsx flow)
const checkoutSummary = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10 })],
  now,
);
const paymentSession = {
  amount: checkoutSummary.total,
  amountPaise: checkoutSummary.totalPaise,
  subtotal: checkoutSummary.subtotal,
  discount: checkoutSummary.discount,
  offerId: checkoutSummary.offerId,
  offerName: checkoutSummary.offerName,
};
assert(
  paymentSession.amount === checkoutSummary.total &&
    paymentSession.amountPaise === checkoutSummary.totalPaise,
  '18) Checkout payable locked into paymentSession',
  JSON.stringify({ checkout: checkoutSummary.total, session: paymentSession.amount }),
);

const upiAmount = formatUpiAmount(paymentSession.amount);
assert(
  upiAmount === '900.00' && upiAmount === paymentSession.amount.toFixed(2),
  '19) UPI amount from locked paymentSession',
  `upi=${upiAmount}`,
);

const orderSnapshot = {
  totalPrice: paymentSession.amount,
  subtotal: paymentSession.subtotal,
  discount: paymentSession.discount,
  amountPaise: paymentSession.amountPaise,
};
assert(
  orderSnapshot.totalPrice === 900 &&
    orderSnapshot.subtotal === 1000 &&
    orderSnapshot.discount === 100 &&
    orderSnapshot.amountPaise === 90000,
  '20) Order snapshot matches subtotal/discount/payable',
  JSON.stringify(orderSnapshot),
);

// Float sanity
assert(fromPaise(lineTotalPaise(0.1, 1) + lineTotalPaise(0.2, 1)) === 0.3, 'float 0.1+0.2 via paise = 0.3');
assert(toPaise(900) === 90000, 'toPaise(900)=90000');

// ---------------------------------------------------------------------------
// 21) DIFFERENT OFFER PRIORITIES — type priority wins over larger ₹ discount
// RULE: Flash (priority 1) beats General (priority 6) even if General saves more.
// ---------------------------------------------------------------------------
const flashOffer = baseOffer({
  id: 'flash',
  type: 'flash',
  title: 'Flash Offer',
  discountType: 'fixed',
  discountValue: 100,
});
const generalLarger = baseOffer({
  id: 'general-big',
  type: 'general',
  title: 'General Offer',
  discountType: 'fixed',
  discountValue: 150,
});
const s21 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [generalLarger, flashOffer],
  now,
);
assert(
  s21.discount === 100 &&
    s21.total === 900 &&
    s21.offerId === 'flash' &&
    s21.offerName === 'Flash Offer',
  '21) priority wins: Flash ₹100 over General ₹150',
  JSON.stringify(s21),
);

// ---------------------------------------------------------------------------
// 22) LEGACY PROMOTION + NEW OFFER — must NOT stack
// Catalog rate stays on cart; offer discount applies once on full subtotal.
// ---------------------------------------------------------------------------
const promoFish = { id: 'pomfret', name: 'Pomfret', rate: 1000, category: 'Seawater' };
const legacyPromotions = {
  isActive: true,
  discountPercentage: 10,
  discountedFish: ['Pomfret'],
};
const marketingPromoPrice = getPromotionalPrice(promoFish, legacyPromotions);
const catalogPrice = getCatalogUnitPrice(promoFish);
assert(
  catalogPrice === 1000 && marketingPromoPrice === 900,
  '22a) legacy promo is display-only (catalog ₹1000, marketing ₹900)',
  `catalog=${catalogPrice} promo=${marketingPromoPrice}`,
);

// Cart uses catalog rate (as addToCart does), plus a 10% store offer
const s22 = calculateCartSummary(
  [{ id: promoFish.id, name: promoFish.name, category: promoFish.category, price: catalogPrice, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10 })],
  now,
);
assert(
  s22.subtotal === 1000 &&
    s22.discount === 100 &&
    s22.total === 900 &&
    s22.discountSource === 'offer',
  '22b) legacy promo + offer do NOT stack (payable ₹900, not ₹810)',
  JSON.stringify(s22),
);

// Contrast: if someone incorrectly baked promo into cart.price AND applied offer
const stackedWrong = calculateCartSummary(
  [{ id: promoFish.id, price: marketingPromoPrice, quantity: 1 }],
  noBasket,
  [baseOffer({ discountType: 'percentage', discountValue: 10 })],
  now,
);
assert(
  stackedWrong.total === 810,
  '22c) (guard) baked promo + offer would yield ₹810 — pipeline must not do this',
  JSON.stringify(stackedWrong),
);
assert(
  s22.total !== stackedWrong.total && s22.total === 900,
  '22d) canonical path avoids stacking (₹900 ≠ ₹810)',
  `canonical=${s22.total} stacked=${stackedWrong.total}`,
);

// ---------------------------------------------------------------------------
// 23) TRANSACTION SUCCESS SNAPSHOT — ignore live promotion changes
// ---------------------------------------------------------------------------
const orderSnapshotAtPlace = {
  totalPrice: 900,
  subtotal: 1000,
  discount: 100,
  offerName: 'Website Launch Offer',
  offerId: 'launch-1',
  discountSource: 'offer',
  items: [{ name: 'Pomfret', price: 1000, quantity: 1 }],
};
const liveSettingsChangedTo20 = { isEnabled: true, percentage: 20, minimumAmount: 1000 };
const display23 = getOrderFinancialBreakdown(orderSnapshotAtPlace);
// Live settings must not affect snapshot display (we never pass them in)
void liveSettingsChangedTo20;
assert(
  display23.subtotal === 1000 &&
    display23.discount === 100 &&
    display23.total === 900 &&
    display23.offerName === 'Website Launch Offer',
  '23) TransactionSuccess uses order snapshot (not live 20%)',
  JSON.stringify(display23),
);

// ---------------------------------------------------------------------------
// 24) PRODUCT PRICE CONSISTENCY — display catalog → cart → checkout → order
// ---------------------------------------------------------------------------
const productRate = getCatalogUnitPrice({ rate: 800 });
const cartLine = { id: 'x', price: productRate, quantity: 1.5 };
const line = lineTotalRupees(cartLine.price, cartLine.quantity);
const s24 = calculateCartSummary([cartLine], noBasket, [], now);
const order24 = {
  subtotal: s24.subtotal,
  discount: s24.discount,
  totalPrice: s24.total,
};
const display24 = getOrderFinancialBreakdown(order24);
assert(
  productRate === 800 &&
    line === 1200 &&
    s24.subtotal === 1200 &&
    display24.subtotal === 1200 &&
    display24.total === 1200,
  '24) product → cart line → subtotal → order snapshot consistent',
  JSON.stringify({ productRate, line, s24, display24 }),
);

// With offer: unit stays catalog; discount only at summary
const s24offer = calculateCartSummary(
  [cartLine],
  noBasket,
  [baseOffer({ discountType: 'fixed', discountValue: 100 })],
  now,
);
assert(
  s24offer.subtotal === 1200 && s24offer.discount === 100 && s24offer.total === 1100,
  '24b) offer does not rewrite unit price; discount at summary only',
  JSON.stringify(s24offer),
);

// ---------------------------------------------------------------------------
// 25) PAYMENT CONSISTENCY — order / session / paise / UPI
// ---------------------------------------------------------------------------
const s25 = calculateCartSummary(
  [{ id: 1, price: 1000, quantity: 1 }],
  noBasket,
  [baseOffer({ title: 'Website Launch Offer', discountType: 'percentage', discountValue: 10 })],
  now,
);
const paymentSession25 = {
  amount: s25.total,
  amountPaise: s25.totalPaise,
  subtotal: s25.subtotal,
  discount: s25.discount,
  offerId: s25.offerId,
  offerName: s25.offerName,
};
const upi25 = formatUpiAmount(paymentSession25.amount);
const order25 = {
  totalPrice: paymentSession25.amount,
  subtotal: paymentSession25.subtotal,
  discount: paymentSession25.discount,
  amountPaise: paymentSession25.amountPaise,
  offerName: paymentSession25.offerName,
};
const paiseAsRupees = fromPaise(paymentSession25.amountPaise);
assert(
  order25.totalPrice === paymentSession25.amount &&
    order25.totalPrice === paiseAsRupees &&
    upi25 === '900.00' &&
    Number(upi25) === order25.totalPrice &&
    order25.discount === 100 &&
    order25.subtotal === 1000,
  '25) order.totalPrice = session.amount = paise→₹ = UPI for offer order',
  JSON.stringify({ order25, upi25, paiseAsRupees }),
);

// ---------------------------------------------------------------------------
// 26–35) DELIVERY CHARGE — added AFTER discount; missing/invalid = ₹0
// ---------------------------------------------------------------------------
assert(normalizeDeliveryChargeRupees(undefined) === 0, '26a) missing deliveryCharge → ₹0');
assert(normalizeDeliveryChargeRupees(null) === 0, '26b) null deliveryCharge → ₹0');
assert(normalizeDeliveryChargeRupees('') === 0, '26c) blank deliveryCharge → ₹0');
assert(normalizeDeliveryChargeRupees(-10) === 0, '26d) negative deliveryCharge → ₹0 (read path)');
assert(normalizeDeliveryChargeRupees('abc') === 0, '26e) non-numeric deliveryCharge → ₹0 (read path)');
assert(normalizeDeliveryChargeRupees(40) === 40, '26f) Admin 40 → ₹40');
assert(normalizeDeliveryChargeRupees(0) === 0, '26g) Admin 0 → ₹0');
assert(parseAdminDeliveryCharge(-10).ok === false, '26h) Admin rejects negative');
assert(parseAdminDeliveryCharge('abc').ok === false, '26i) Admin rejects non-numeric');
assert(parseAdminDeliveryCharge('').ok === true && parseAdminDeliveryCharge('').value === 0, '26j) Admin blank → 0');
assert(parseAdminDeliveryCharge(40).ok === true && parseAdminDeliveryCharge(40).value === 40, '26k) Admin 40 accepted');

const cart400 = [{ id: 1, price: 400, quantity: 1 }];
const offer5pct = [baseOffer({ discountType: 'percentage', discountValue: 5 })];

const s27 = calculateCartSummary(cart400, noBasket, offer5pct, now, 0);
assert(
  s27.subtotal === 400 &&
    s27.discount === 20 &&
    s27.deliveryCharge === 0 &&
    s27.total === 380 &&
    s27.totalPaise === 38000,
  '27) ₹400 + ₹20 discount + ₹0 delivery = ₹380',
  JSON.stringify(s27),
);

const s28 = calculateCartSummary(cart400, noBasket, offer5pct, now, 40);
assert(
  s28.subtotal === 400 &&
    s28.discount === 20 &&
    s28.deliveryCharge === 40 &&
    s28.deliveryChargePaise === 4000 &&
    s28.total === 420 &&
    s28.totalPaise === 42000,
  '28) ₹400 + ₹20 discount + ₹40 delivery = ₹420',
  JSON.stringify(s28),
);

assert(
  s28.discount === s27.discount,
  '29) delivery is not discounted (offer stays ₹20)',
  `d0=${s27.discount} d40=${s28.discount}`,
);

const fourArgNow = calculateCartSummary(cart400, noBasket, offer5pct, now);
assert(
  fourArgNow.deliveryCharge === 0 && fourArgNow.total === 380,
  '30) 4th arg remains `now`; omitted 5th arg defaults delivery to ₹0',
  JSON.stringify(fourArgNow),
);

const session28 = {
  amount: s28.total,
  amountPaise: s28.totalPaise,
  deliveryCharge: s28.deliveryCharge,
  deliveryChargePaise: s28.deliveryChargePaise,
};
const upi28 = formatUpiAmount(session28.amount);
const order28 = {
  totalPrice: session28.amount,
  amountPaise: session28.amountPaise,
  subtotal: s28.subtotal,
  discount: s28.discount,
  deliveryCharge: session28.deliveryCharge,
  deliveryChargePaise: session28.deliveryChargePaise,
};
assert(
  s28.total === session28.amount &&
    session28.amountPaise === 42000 &&
    upi28 === '420.00' &&
    order28.totalPrice === 420 &&
    order28.deliveryCharge === 40 &&
    order28.deliveryChargePaise === 4000,
  '31) Cart total = checkout payable = UPI = order total (₹420) with snapshot charge',
  JSON.stringify({ s28: s28.total, upi28, order28 }),
);

const buyNow28 = calculateCartSummary(
  cart400,
  { ...noBasket, isEnabled: false },
  offer5pct,
  now,
  40,
);
assert(
  buyNow28.total === 420 && buyNow28.deliveryCharge === 40 && buyNow28.discount === 20,
  '32) Buy Now uses same delivery charge as cart checkout',
  JSON.stringify(buyNow28),
);

assert(
  s27.totalPaise !== s28.totalPaise,
  '33) mid-checkout Admin 0→40 is detected (locked 38000 ≠ live 42000)',
  `locked=${s27.totalPaise} live=${s28.totalPaise}`,
);

const oldOrder = getOrderFinancialBreakdown({
  totalPrice: 380,
  subtotal: 400,
  discount: 20,
});
assert(
  oldOrder.deliveryCharge === 0 && oldOrder.total === 380 && oldOrder.subtotal === 400,
  '34) old order missing deliveryCharge → ₹0; original total unchanged',
  JSON.stringify(oldOrder),
);

const newOrderDisplay = getOrderFinancialBreakdown(order28);
assert(
  newOrderDisplay.deliveryCharge === 40 && newOrderDisplay.total === 420,
  '35) new order snapshot displays deliveryCharge ₹40',
  JSON.stringify(newOrderDisplay),
);

assert(
  s27.deliveryCharge === 0,
  '36) FREE DELIVERY visibility: charge === 0',
);
assert(
  s28.deliveryCharge > 0,
  '37) FREE DELIVERY hidden when charge > 0',
);

console.log('\n========================================');
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('========================================');
if (failed > 0) {
  console.error('\nFailures:');
  failures.forEach((f) => console.error(f));
  process.exit(1);
}
