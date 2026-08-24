/**
 * Netlify adapter for /api/transcribe — forwards Authorization + X-Venue-Id.
 */
const transcribeHandler = require('../../api/transcribe.js');
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

  await transcribeHandler(req, res);
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
};
