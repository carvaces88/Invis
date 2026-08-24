/**
 * Netlify function adapter for the same contract as /api/vision (Vercel).
 * POST /.netlify/functions/vision
 * Forwards Authorization + X-Venue-Id so Gemini stays behind venue quotas.
 */
const visionHandler = require('../../api/vision.js');
const { AUTH_CORS_HEADERS } = require('../../api/_lib/auth');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': AUTH_CORS_HEADERS,
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const req = {
    method: event.httpMethod,
    body,
    headers: event.headers || {},
    query: event.queryStringParameters || {},
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

  await visionHandler(req, res);
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
};
