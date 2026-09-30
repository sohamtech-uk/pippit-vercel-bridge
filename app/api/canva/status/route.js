import { canvaUnauthorized, verifyCanvaRequest } from '../../../../lib/canva-auth';
import { getThread } from '../../../../lib/pippit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await verifyCanvaRequest(request);
  if (!auth.ok) return canvaUnauthorized(auth.reason);

  try {
    const body = await request.json();
    const result = await getThread({
      threadId: body.thread_id,
      runId: body.run_id,
      afterSeq: body.after_seq || 0,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
