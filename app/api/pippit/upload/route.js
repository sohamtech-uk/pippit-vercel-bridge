import { isBridgeAuthorized, unauthorized } from '../../../../lib/auth';
import { uploadReference } from '../../../../lib/pippit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request) {
  if (!isBridgeAuthorized(request)) return unauthorized();

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: 'Reference file is too large for this Vercel bridge. Keep it under 4 MB.' },
        { status: 413 },
      );
    }
    return Response.json(await uploadReference(file));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
