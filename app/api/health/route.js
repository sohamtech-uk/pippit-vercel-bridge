import { requireBridgeConfig } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const missing = requireBridgeConfig();
  return Response.json({
    ok: missing.length === 0,
    service: 'pippit-vercel-bridge',
    missing_configuration: missing,
  });
}
