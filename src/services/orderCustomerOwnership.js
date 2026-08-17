/**
 * Phase 1A.8 order ownership.
 *
 * customerUid is derived only from Firebase Auth.
 * Caller-supplied customerUid is never trusted.
 * Delivery mobile is not ownership.
 */

import { getCustomerIdentityFromUser } from './customerProfile.js';

export const resolveOrderCustomerUid = (user) => {
  const identity = getCustomerIdentityFromUser(user);
  return identity?.uid;
};

/**
 * Strip any incoming customerUid, then attach ownership only for a valid
 * FishMart customer Auth user. Guests, Admins, and invalid users omit the field.
 */
export const applyOrderCustomerOwnership = (order, user) => {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return order;
  }

  const { customerUid: _ignoredCallerUid, ...rest } = order;
  const customerUid = resolveOrderCustomerUid(user);
  if (!customerUid) {
    return rest;
  }
  return { ...rest, customerUid };
};
