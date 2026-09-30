import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { isBridgeAuthorized, unauthorized } from '../../../lib/auth';
import { getThread, submitRun } from '../../../lib/pippit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    server.tool(
      'pippit_submit_run',
      'Start or continue a Pippit creative generation. This can consume Pippit credits; obtain explicit user confirmation before calling it.',
      {
        message: z.string().min(1).describe('The user\'s original creative request.'),
        thread_id: z.string().optional().describe('Existing Pippit thread ID for refinements.'),
        asset_ids: z.array(z.string()).optional().describe('Reference asset IDs already uploaded to Pippit.'),
      },
      async ({ message, thread_id, asset_ids }) => {
        const result = await submitRun({ message, threadId: thread_id || '', assetIds: asset_ids || [] });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'pippit_get_run_status',
      'Check a Pippit run without consuming generation credits. Returns output URLs when generation is complete.',
      {
        thread_id: z.string().min(1),
        run_id: z.string().min(1),
        after_seq: z.number().int().nonnegative().optional(),
      },
      async ({ thread_id, run_id, after_seq }) => {
        const result = await getThread({ threadId: thread_id, runId: run_id, afterSeq: after_seq || 0 });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  },
  {},
  { basePath: '/api' },
);

async function protectedHandler(request) {
  if (!isBridgeAuthorized(request)) return unauthorized();
  return mcpHandler(request);
}

export { protectedHandler as GET, protectedHandler as POST, protectedHandler as DELETE };
