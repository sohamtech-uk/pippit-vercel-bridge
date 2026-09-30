import crypto from 'node:crypto';

export function isBridgeAuthorized(request) {
  const expected = process.env.BRIDGE_API_KEY;
  if (!expected) return false;

  const authorization = request.headers.get('authorization') || '';
  const candidate = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!candidate) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function unauthorized() {
  return Response.json(
    { error: 'Unauthorized' },
    {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
    },
  );
}

export function requireBridgeConfig() {
  const missing = [];
  if (!process.env.PIPPIT_ACCESS_KEY) missing.push('PIPPIT_ACCESS_KEY');
  if (!process.env.BRIDGE_API_KEY) missing.push('BRIDGE_API_KEY');
  return missing;
}
