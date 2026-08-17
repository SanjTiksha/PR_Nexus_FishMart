'use strict';

const { getAllowedOrigins } = require('./config');

const GENERIC = {
  invalidRequest: 'Invalid request',
  verificationFailed: 'Verification failed',
  unavailable: 'Verification unavailable',
};

const header = (req, name) => {
  if (req && typeof req.get === 'function') {
    const value = req.get(name);
    if (value) return String(value);
  }
  const headers = req && req.headers ? req.headers : {};
  const direct = headers[name] || headers[name.toLowerCase()];
  return direct ? String(direct) : '';
};

const applyCors = (req, res, env = process.env) => {
  const origin = header(req, 'origin');
  const allowed = getAllowedOrigins(env);
  if (origin && allowed.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
  }
};

const sendJson = (res, status, body) => {
  res.status(status);
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
};

const isJsonContentType = (req) => {
  const raw = header(req, 'content-type').toLowerCase();
  return raw.startsWith('application/json');
};

module.exports = {
  GENERIC,
  header,
  applyCors,
  sendJson,
  isJsonContentType,
};
