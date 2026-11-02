import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { actor } from "@/lib/asshown/access";
import { assetInput } from "@/lib/asshown/assets";
import { changeRecord, listRecords } from "@/lib/asshown/records";
import { originAllowed, consumeRateLimit } from "@/lib/security";
export async function POST(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const a = await actor(request);
  if (!a.user || !a.owner)
    return NextResponse.json(
      { error: "Sign in to upload private evidence." },
      { status: 401 },
    );
  if (!(await consumeRateLimit(`upload-token:${a.owner}`, 20, 3600)).allowed)
    return NextResponse.json(
      { error: "Upload allowance reached." },
      { status: 429 },
    );
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, payload) => {
        const id = pathname.match(
          /^quarantine\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/,
        )?.[1];
        if (!id) throw new Error("Invalid upload destination.");
        const input = assetInput.parse(JSON.parse(payload ?? "null"));
        if ((await listRecords("upload-intent", a.owner!)).length >= 60)
          throw new Error("Pending upload allowance reached.");
        await changeRecord(id, a.owner!, "upload-intent", (current) => {
          if (current) throw new Error("Upload destination already used.");
          return {
            key: pathname,
            input,
            expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
          };
        });
        return {
          allowedContentTypes: ["image/png", "image/jpeg"],
          maximumSizeInBytes: 10 * 1024 * 1024,
          validUntil: Date.now() + 5 * 60000,
          allowOverwrite: false,
          addRandomSuffix: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not authorize this private upload. Check its size and storage consent.",
      },
      { status: 400 },
    );
  }
}
