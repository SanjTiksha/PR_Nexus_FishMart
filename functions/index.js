'use strict';

const { initializeApp, getApps } = require('firebase-admin/app');
const { onRequest } = require('firebase-functions/v2/https');
const { handleCustomerMsg91Session } = require('./src/customerMsg91Session');

// Required by the Functions runtime. Auth is used only to mint Custom Tokens.
if (getApps().length === 0) {
  initializeApp();
}

/**
 * HTTPS function: POST { "token": "<MSG91 verified token>" }
 * Success: { "customToken": "<Firebase Custom Token>" }
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
