/**
 * Frontend allowlist for Admin Panel Firebase Email/Password users.
 * Firestore rules are not changed in Phase A — this only gates the Admin UI.
 */

export const AUTHORIZED_ADMIN_EMAILS = [
  'support@prnexusgroup.com',
  'info@prnexusgroup.com',
];

export const normalizeAdminEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase();

/** True if Firebase user email is an authorized management account. */
export const isAuthorizedAdminUser = (user) => {
  if (!user?.email) return false;
  const email = normalizeAdminEmail(user.email);
  return AUTHORIZED_ADMIN_EMAILS.includes(email);
};
