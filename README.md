# Pippit × ChatGPT × Canva — Vercel Bridge

A small personal bridge that keeps your Pippit secret server-side and gives you:

- a private web UI for uploading a Canva still and sending it to Pippit;
- a secure REST API for ChatGPT / Custom GPT Actions;
- a Vercel MCP endpoint (`/api/mcp`) for MCP-capable clients;
- Pippit thread/run polling and public generated result URLs that can be imported back into Canva.

## Security first

A Pippit key was previously pasted into chat. **Rotate/revoke it before using this project.** Never put the replacement key into source code or chat. Add it directly to Vercel as an encrypted environment variable.

## Verified Pippit API surface

This project uses the same endpoints documented in Pippit's official `Pippit-dev/pippit-skills` repository:

- `POST /api/biz/v1/skill/submit_run`
- `POST /api/biz/v1/skill/get_thread`
- `POST /api/biz/v1/skill/upload_file`

Authentication is `Authorization: Bearer <PIPPIT_ACCESS_KEY>`.

## Deploy to Vercel

```bash
npm install
npx vercel
```

Add secrets (do this in your own terminal or Vercel dashboard):

```bash
npx vercel env add PIPPIT_ACCESS_KEY production
npx vercel env add BRIDGE_API_KEY production
npx vercel env add PIPPIT_BASE_URL production
```

Use `https://www.pippit.ai` for `PIPPIT_BASE_URL`.

Generate a bridge key locally, for example:

```bash
openssl rand -hex 32
```

Then deploy production:

```bash
npx vercel --prod
```

## Connect ChatGPT using a Custom GPT Action

The most practical private connection is the REST/OpenAPI action:

1. Open your GPT editor and create an Action.
2. Use `https://YOUR-DOMAIN.vercel.app/openapi.json` as the schema source, or paste the schema returned by that URL.
3. Authentication: API key → Bearer.
4. Use the value of `BRIDGE_API_KEY`, **not** your Pippit key.
5. Test `submitPippitRun` and `getPippitRunStatus`.

The action description tells ChatGPT that generation consumes credits, so it should get explicit confirmation before submitting a new run.

## MCP endpoint

`https://YOUR-DOMAIN.vercel.app/api/mcp`

It exposes:

- `pippit_submit_run`
- `pippit_get_run_status`

The MCP endpoint also expects `Authorization: Bearer <BRIDGE_API_KEY>`. Static bearer works with MCP clients that can supply an authorization header or an MCP credential vault. ChatGPT's exact custom-app auth options depend on your account/workspace rollout; use the Custom GPT Action path above if static bearer is not offered in the app UI.

## Canva workflow today

### Canva → Pippit

1. Create the still in Canva.
2. Export it as PNG/JPG.
3. Open the bridge dashboard.
4. Upload the still (v1 limit: 4 MB).
5. Paste your motion prompt and generate.

### Pippit → Canva

When Pippit finishes, the bridge returns generated public result URL(s). In ChatGPT, the existing Canva connection can import a public image/video URL into your Canva library.

A future v2 can add a Canva Developer App so a selected Canva element can be sent directly to the bridge without manual export.

## API examples

Submit:

```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/pippit/submit \
  -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a cinematic 5-second video"}'
```

Check status:

```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/pippit/status \
  -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"thread_id":"...","run_id":"..."}'
```

## Notes

- Pippit creative jobs are asynchronous. Submit first, then poll status.
- If Pippit returns `requires_action`, continue the same thread with the user's answer.
- The web upload route intentionally caps reference files at 4 MB to stay below practical serverless request limits. This is enough for compressed 9:16 stills; add object storage/direct upload later for large video references.
