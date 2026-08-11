/**
 * Single source of truth for FishMart delivery preference availability & labels.
 * Business clock: Asia/Kolkata (see deliveryConfig.js).
 *
 * Stored values (new orders): deliveryDate YYYY-MM-DD, deliverySlot MORNING|EVENING
 * Legacy display compat: Morning / Evening title-case still accepted when reading.
 */

import { DELIVERY_CONFIG, DELIVERY_SLOT } from '../config/deliveryConfig';

export { DELIVERY_SLOT };
export const BUSINESS_TIMEZONE = DELIVERY_CONFIG.TIMEZONE;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad2 = (n) => String(n).padStart(2, '0');

const parseHm = (hm) => {
  const [h, m] = String(hm || '0:0').split(':').map((x) => Number(x));
  return { hour: h || 0, minute: m || 0 };
};

/** Current calendar + clock parts in business timezone. */
export const getBusinessNowParts = (date = new Date()) => {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = Number(get('hour'));
  // Some engines emit 24:00 for midnight — normalize
  if (hour === 24) hour = 0;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
  };
};

export const getTodayDateKey = (date = new Date()) => {
  const { year, month, day } = getBusinessNowParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

export const getTomorrowDateKey = (date = new Date()) => {
  const { year, month, day } = getBusinessNowParts(date);
  // Calendar arithmetic on the IST date parts (not wall-clock UTC shift).
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
};

export const formatDeliveryDateShort = (dateKey) => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export const formatDeliveryDateLong = (dateKey) => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** Normalize any legacy/new slot string → MORNING | EVENING | null */
export const normalizeSlot = (slot) => {
  const s = String(slot || '').trim().toUpperCase();
  if (s === 'MORNING') return DELIVERY_SLOT.MORNING;
  if (s === 'EVENING') return DELIVERY_SLOT.EVENING;
  return null;
};

export const isValidDeliverySlot = (slot) => normalizeSlot(slot) != null;

export const slotDisplayLabel = (slot) => {
  const n = normalizeSlot(slot);
  if (n === DELIVERY_SLOT.MORNING) return 'Morning';
  if (n === DELIVERY_SLOT.EVENING) return 'Evening';
  return '';
};

export const slotEmoji = (slot) =>
  normalizeSlot(slot) === DELIVERY_SLOT.EVENING ? '🌆' : '🌅';

const minutesNow = (parts) => parts.hour * 60 + parts.minute;

const isAtOrAfterHm = (parts, hm) => {
  const { hour, minute } = parseHm(hm);
  return minutesNow(parts) >= hour * 60 + minute;
};

/**
 * Whether a specific date+slot is still bookable at `now`.
 * @param {string} dateKey YYYY-MM-DD
 * @param {'MORNING'|'EVENING'|string} slot
 */
export const isDeliveryOptionAvailable = (dateKey, slot, now = new Date()) => {
  const normalized = normalizeSlot(slot);
  if (!normalized || !dateKey) return false;

  const today = getTodayDateKey(now);
  const tomorrow = getTomorrowDateKey(now);
  const parts = getBusinessNowParts(now);

  if (dateKey !== today && dateKey !== tomorrow) return false;

  // Today closed entirely at/after 21:00
  if (dateKey === today && isAtOrAfterHm(parts, DELIVERY_CONFIG.TODAY_CUTOFF_TIME)) {
    return false;
  }

  // Today Morning closed at/after morning end
  if (
    dateKey === today &&
    normalized === DELIVERY_SLOT.MORNING &&
    isAtOrAfterHm(parts, DELIVERY_CONFIG.MORNING_SLOT_END_TIME)
  ) {
    return false;
  }

  // Tomorrow always both slots (until that day becomes today)
  return true;
};

/**
 * Available delivery options for UI + validation.
 * @returns {Array<{ dateKey: string, dayLabel: 'Today'|'Tomorrow', slot: string, available: true }>}
 */
export const getAvailableDeliveryOptions = (now = new Date()) => {
  const today = getTodayDateKey(now);
  const tomorrow = getTomorrowDateKey(now);
  const options = [];

  const pushIf = (dateKey, dayLabel, slot) => {
    if (isDeliveryOptionAvailable(dateKey, slot, now)) {
      options.push({
        dateKey,
        dayLabel,
        slot,
        available: true,
      });
    }
  };

  pushIf(today, 'Today', DELIVERY_SLOT.MORNING);
  pushIf(today, 'Today', DELIVERY_SLOT.EVENING);
  pushIf(tomorrow, 'Tomorrow', DELIVERY_SLOT.MORNING);
  pushIf(tomorrow, 'Tomorrow', DELIVERY_SLOT.EVENING);

  return options;
};

export const isTodayDeliveryClosed = (now = new Date()) => {
  const parts = getBusinessNowParts(now);
  return isAtOrAfterHm(parts, DELIVERY_CONFIG.TODAY_CUTOFF_TIME);
};

/**
 * Validate a customer selection against current business time.
 * @returns {{ ok: true, deliveryDate: string, deliverySlot: string } | { ok: false, reason: string }}
 */
export const validateDeliverySelection = (deliveryDate, deliverySlot, now = new Date()) => {
  const slot = normalizeSlot(deliverySlot);
  if (!slot) {
    return { ok: false, reason: 'Please choose a Morning or Evening delivery slot.' };
  }
  if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return { ok: false, reason: 'Please choose a valid delivery date.' };
  }
  if (!isDeliveryOptionAvailable(deliveryDate, slot, now)) {
    return {
      ok: false,
      reason:
        'Your selected delivery slot has just closed. Please choose another available delivery time.',
    };
  }
  return { ok: true, deliveryDate, deliverySlot: slot };
};

/**
 * Persistable preference. If current selection invalid, clear slot (force re-select).
 * Does not silently switch to another option.
 */
export const normalizeDeliveryPreference = (pref, now = new Date()) => {
  const dateKey = pref?.deliveryDate;
  const slot = normalizeSlot(pref?.deliverySlot);
  if (dateKey && slot && isDeliveryOptionAvailable(dateKey, slot, now)) {
    return { deliveryDate: dateKey, deliverySlot: slot };
  }
  // Keep date hint if still a valid day with some slots, else clear
  const available = getAvailableDeliveryOptions(now);
  const dateStillUseful =
    dateKey && available.some((o) => o.dateKey === dateKey);
  return {
    deliveryDate: dateStillUseful ? dateKey : null,
    deliverySlot: null,
  };
};

/** Group available options by day for compact checkout UI */
export const groupAvailableOptionsByDay = (now = new Date()) => {
  const options = getAvailableDeliveryOptions(now);
  const map = new Map();
  options.forEach((o) => {
    if (!map.has(o.dateKey)) {
      map.set(o.dateKey, {
        dateKey: o.dateKey,
        dayLabel: o.dayLabel,
        dateShort: formatDeliveryDateShort(o.dateKey),
        slots: [],
      });
    }
    map.get(o.dateKey).slots.push(o.slot);
  });
  return [...map.values()];
};

/**
 * Human label for UI / WhatsApp / confirmation.
 * Uses Today/Tomorrow relative to *now* when the stored date matches; else absolute short date.
 */
export const formatDeliveryPreferenceLabel = (orderOrPref, now = new Date()) => {
  const dateKey =
    orderOrPref?.deliveryDate ||
    orderOrPref?.deliveryInfo?.deliveryDate ||
    '';
  const slot =
    orderOrPref?.deliverySlot ||
    orderOrPref?.deliveryInfo?.deliverySlot ||
    '';
  const slotLabel = slotDisplayLabel(slot);
  if (!dateKey && !slotLabel) return null;

  const today = getTodayDateKey(now);
  const tomorrow = getTomorrowDateKey(now);
  let dayPart = formatDeliveryDateShort(dateKey) || '';
  if (dateKey === today) dayPart = `Today · ${formatDeliveryDateShort(dateKey)}`;
  else if (dateKey === tomorrow) dayPart = `Tomorrow · ${formatDeliveryDateShort(dateKey)}`;
  else if (dateKey) dayPart = formatDeliveryDateLong(dateKey);

  if (dayPart && slotLabel) return `${dayPart} · ${slotLabel}`;
  if (dayPart) return dayPart;
  return slotLabel;
};

/** Admin-friendly: always show concrete date + slot */
export const formatDeliveryPreferenceAdmin = (orderOrPref) => {
  const dateKey =
    orderOrPref?.deliveryDate ||
    orderOrPref?.deliveryInfo?.deliveryDate ||
    '';
  const slot =
    orderOrPref?.deliverySlot ||
    orderOrPref?.deliveryInfo?.deliverySlot ||
    '';
  const slotLabel = slotDisplayLabel(slot);
  if (!dateKey && !slotLabel) return null;
  const datePart = dateKey ? formatDeliveryDateLong(dateKey) : '';
  if (datePart && slotLabel) return `${datePart} · ${slotLabel}`;
  return datePart || slotLabel;
};

// Legacy aliases used by older call sites
export const DEFAULT_DELIVERY_SLOT = DELIVERY_SLOT.MORNING;
export const DELIVERY_SLOTS = [DELIVERY_SLOT.MORNING, DELIVERY_SLOT.EVENING];
export const formatTomorrowHeading = (dateKey = getTomorrowDateKey()) =>
  `Tomorrow · ${formatDeliveryDateShort(dateKey)}`;
