export const dynamic = 'force-dynamic';

export async function GET(request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    openapi: '3.1.0',
    info: {
      title: 'Pippit Bridge',
      version: '0.1.0',
      description: 'Secure personal bridge from ChatGPT to the Pippit creative agent API.',
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        SubmitRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', description: 'Original creative request. Do not silently rewrite it.' },
            thread_id: { type: 'string', description: 'Existing Pippit thread ID for follow-up/refinement.' },
            asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional reference asset IDs uploaded to Pippit.' },
          },
        },
        StatusRequest: {
          type: 'object',
          required: ['thread_id', 'run_id'],
          properties: {
            thread_id: { type: 'string' },
            run_id: { type: 'string' },
            after_seq: { type: 'integer', default: 0 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/pippit/submit': {
        post: {
          operationId: 'submitPippitRun',
          summary: 'Start or continue a Pippit creative generation',
          description: 'This action can consume Pippit credits. Confirm with the user before submitting generation.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmitRequest' } } },
          },
          responses: { '200': { description: 'Pippit thread and run identifiers' } },
        },
      },
      '/api/pippit/status': {
        post: {
          operationId: 'getPippitRunStatus',
          summary: 'Check Pippit generation status and output URLs',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusRequest' } } },
          },
          responses: { '200': { description: 'Status, messages, interactions and generated download URLs' } },
        },
      },
    },
  });
}
