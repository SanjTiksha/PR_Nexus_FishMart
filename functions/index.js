'use strict';

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { onRequest } = require('firebase-functions/v2/https');
const { handleCustomerMsg91Session } = require('./src/customerMsg91Session');

// Required by the Functions runtime. Auth is used only to mint Custom Tokens.
// Local: cert(GOOGLE_APPLICATION_CREDENTIALS) → ServiceAccountCredential, local signing.
// Production: GAC unset → initializeApp() ADC / runtime default. Do not require a local JSON file.
if (getApps().length === 0) {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof credentialsPath === 'string' && credentialsPath.trim()) {
    initializeApp({
      credential: cert(credentialsPath.trim()),
    });
  } else {
    initializeApp();
  }
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
