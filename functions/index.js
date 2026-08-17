'use strict';

const { initializeApp, getApps } = require('firebase-admin/app');
const { onRequest } = require('firebase-functions/v2/https');
const { handleCustomerMsg91Session } = require('./src/customerMsg91Session');

// Required by the Functions runtime/emulator. Phase 1A.2 does not mint
// Custom Tokens or use firebase-admin Auth.
if (getApps().length === 0) {
  initializeApp();
}

/**
 * HTTPS function: POST { "token": "<MSG91 verified token>" }
 * Success: { "ok": true }
 *
 * CORS is handled inside the handler with an explicit origin allowlist.
 * firebase-functions cors is disabled so this never sends *.
 */
exports.customerMsg91Session = onRequest(
  {
    cors: false,
    invoker: 'public',
  },
  handleCustomerMsg91Session,
);
