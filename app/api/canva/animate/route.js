import { canvaUnauthorized, verifyCanvaRequest } from '../../../../lib/canva-auth';
import { submitRun, uploadReferenceFromCanvaUrl } from '../../../../lib/pippit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await verifyCanvaRequest(request);
  if (!auth.ok) return canvaUnauthorized(auth.reason);

  try {
    const body = await request.json();
    if (!body.asset_url) {
      return Response.json({ error: 'asset_url is required' }, { status: 400 });
    }
    if (!body.message || !String(body.message).trim()) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    const asset = await uploadReferenceFromCanvaUrl(body.asset_url);
    const run = await submitRun({
      message: String(body.message),
      threadId: body.thread_id || '',
      assetIds: [asset.asset_id],
    });

    return Response.json({
      ...run,
      pippit_asset_id: asset.asset_id,
      canva_user_id: auth.identity?.userId,
      canva_brand_id: auth.identity?.brandId,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
