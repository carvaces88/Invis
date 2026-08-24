/**
 * Netlify adapter — same contract as /api/kruoka-lookup (Vercel).
 * Forwards Authorization + X-Venue-Id for per-venue quotas + EAN cache.
 */
const kruokaHandler = require('../../api/kruoka-lookup.js');
const { AUTH_CORS_HEADERS } = require('../../api/_lib/auth');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': AUTH_CORS_HEADERS,
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const req = {
    method: event.httpMethod,
    headers: event.headers || {},
    query: event.queryStringParameters || {},
    body: {},
  };
  let statusCode = 200;
  let payload = {};

  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    end() {},
    json(obj) {
      payload = obj;
    },
  };

  await kruokaHandler(req, res);
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
};
