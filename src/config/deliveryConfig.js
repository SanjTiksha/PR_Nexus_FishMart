/**
 * Central delivery business rules — change times here only.
 * All availability/validation must import from this file (via deliverySlot utils).
 */
export const DELIVERY_CONFIG = {
  TIMEZONE: 'Asia/Kolkata',
  /** After this time (inclusive), TODAY is no longer selectable. */
  TODAY_CUTOFF_TIME: '21:00',
  /** On TODAY, Morning slot closes at this time (inclusive = closed). */
  MORNING_SLOT_END_TIME: '13:00',
};

export const DELIVERY_SLOT = {
  MORNING: 'MORNING',
  EVENING: 'EVENING',
};
