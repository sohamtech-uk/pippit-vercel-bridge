import { isBridgeAuthorized, unauthorized } from '../../../../lib/auth';
import { submitRun } from '../../../../lib/pippit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  if (!isBridgeAuthorized(request)) return unauthorized();

  try {
    const body = await request.json();
    const result = await submitRun({
      message: body.message,
      threadId: body.thread_id || '',
      assetIds: Array.isArray(body.asset_ids) ? body.asset_ids : [],
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
