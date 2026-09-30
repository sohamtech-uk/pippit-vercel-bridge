# Direct Canva → Pippit workflow

The goal is to remove the manual PNG/JPG upload from the bridge.

## Final user flow

1. Open a Canva design.
2. Select exactly one image.
3. Open the private **Pippit Animate** Canva app.
4. Enter a motion prompt.
5. Click **Animate selected image**.
6. The Canva app uses the Selection API to read the selected image and `getTemporaryUrl` to obtain a short-lived full-resolution URL.
7. The app sends that URL to `/api/canva/animate`.
8. The Vercel backend immediately downloads the Canva image, uploads it to Pippit, and starts generation.
9. The app polls `/api/canva/status`.
10. When Pippit returns a generated video URL, the Canva app uploads it back into Canva and adds it to the design.

No local download or file picker is needed.

## Canva permissions

Enable:

- `canva:design:content:read`
- `canva:design:content:write`
- `canva:asset:private:read`
- `canva:asset:private:write`

## Vercel

Add:

```
CANVA_APP_ID=<your Canva Developer app ID>
```

The backend verifies Canva user JWTs with `@canva/app-middleware`.

## Core app logic

```tsx
import { useSelection } from "@canva/app-hooks";
import { getTemporaryUrl, upload } from "@canva/asset";
import { auth } from "@canva/user";
import { addElementAtPoint } from "@canva/design";

const selected = useSelection("image");

async function animateSelectedImage(prompt: string) {
  const draft = await selected.read();
  if (draft.contents.length !== 1) {
    throw new Error("Select exactly one image");
  }

  const source = draft.contents[0];
  const { url } = await getTemporaryUrl({
    type: "image",
    ref: source.ref,
  });

  const token = await auth.getCanvaUserToken();

  const startResponse = await fetch(
    "https://YOUR-BRIDGE-DOMAIN/api/canva/animate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset_url: url,
        message: prompt,
      }),
    },
  );

  const start = await startResponse.json();

  // Poll /api/canva/status with the same Canva user JWT until completed.
  // Then upload the returned public Pippit video URL:
  const generatedVideoUrl = "...";

  const video = await upload({
    type: "video",
    url: generatedVideoUrl,
    mimeType: "video/mp4",
    aiDisclosure: "app_generated",
  });

  await video.whenUploaded();
  await addElementAtPoint({
    type: "video",
    ref: video.ref,
  });
}
```

## Deployment protection

The production bridge URL must be reachable by Canva. If Vercel Authentication protects production, Canva cannot call the backend.
