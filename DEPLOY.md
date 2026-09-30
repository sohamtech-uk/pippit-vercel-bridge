# Deployment checklist

1. Rotate the Pippit key that was exposed in chat.
2. Deploy this repository to Vercel under the team `sohamtechuk's projects`.
3. Add `PIPPIT_ACCESS_KEY` directly in Vercel Project Settings → Environment Variables.
4. Add a random `BRIDGE_API_KEY` directly in Vercel.
5. Set `PIPPIT_BASE_URL=https://www.pippit.ai`.
6. Redeploy after adding the variables.
7. Visit `/api/health` — `ok` should be `true` and no missing configuration should be listed.
8. Open the home page, enter the bridge key, upload a Canva-exported scene, and test one short Pippit generation.
9. Connect `/openapi.json` to a Custom GPT Action using Bearer auth with the bridge key.
10. Optionally connect `/api/mcp` from an MCP-capable client using the same bridge key.
