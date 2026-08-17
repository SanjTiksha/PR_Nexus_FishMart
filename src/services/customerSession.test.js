import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAccountRedirectPath, isCustomerUser } from './customerSession.js';

describe('isCustomerUser', () => {
  it('is false when there is no user', () => {
    assert.equal(isCustomerUser(null), false);
    assert.equal(isCustomerUser(undefined), false);
  });

  it('is false for allowlisted Admin emails', () => {
    assert.equal(
      isCustomerUser({ email: 'support@prnexusgroup.com' }),
      false,
    );
    assert.equal(isCustomerUser({ email: 'info@prnexusgroup.com' }), false);
  });

  it('is true for a non-admin Firebase user', () => {
    assert.equal(isCustomerUser({ uid: 'phone_91xxxxxxxxxx' }), true);
  });
});

describe('getAccountRedirectPath', () => {
  it('sends guests to login', () => {
    assert.equal(getAccountRedirectPath(null), '/login');
    assert.equal(getAccountRedirectPath(undefined), '/login');
  });

  it('sends allowlisted Admins to admin without treating them as customers', () => {
    assert.equal(
      getAccountRedirectPath({ email: 'support@prnexusgroup.com' }),
      '/admin',
    );
    assert.equal(
      getAccountRedirectPath({ email: 'info@prnexusgroup.com' }),
      '/admin',
    );
  });

  it('lets customers stay on the account hub', () => {
    assert.equal(getAccountRedirectPath({ uid: 'phone_91xxxxxxxxxx' }), null);
  });
});
