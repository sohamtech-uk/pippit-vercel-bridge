import { initUserTokenVerifier } from '@canva/app-middleware';

let verifier;

function getVerifier() {
  const appId = process.env.CANVA_APP_ID;
  if (!appId) return null;
  if (!verifier) verifier = initUserTokenVerifier({ appId });
  return verifier;
}

export async function verifyCanvaRequest(request) {
  const currentVerifier = getVerifier();
  if (!currentVerifier) {
    return { ok: false, reason: 'CANVA_APP_ID is not configured' };
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) return { ok: false, reason: 'Missing Canva user token' };

  try {
    const identity = await currentVerifier.verify(token);
    return { ok: true, identity };
  } catch {
    return { ok: false, reason: 'Invalid Canva user token' };
  }
}

export function canvaUnauthorized(reason = 'Unauthorized Canva request') {
  return Response.json({ error: reason }, { status: 401 });
}
