/**
 * Customer session helpers.
 *
 * Auth truth is the existing Firebase Auth instance only.
 * Allowlisted Admin users are never treated as customers.
 */

import { isAuthorizedAdminUser } from '../utils/adminAuth.js';

export const isCustomerUser = (user) => Boolean(user) && !isAuthorizedAdminUser(user);

/**
 * /account gate. Returns a redirect path, or null to show the customer hub.
 * Does not sign anyone out.
 */
export const getAccountRedirectPath = (user) => {
  if (!user) return '/login';
  if (isAuthorizedAdminUser(user)) return '/admin';
  return null;
};
