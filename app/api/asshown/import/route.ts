import { NextRequest, NextResponse } from "next/server";
import { importRetailer } from "@/lib/asshown/importer";
import {
  originAllowed,
  consumeRateLimit,
  requestFingerprint,
} from "@/lib/security";
export async function POST(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  try {
    if (
      !(
        await consumeRateLimit(
          `import:${requestFingerprint(request)}`,
          10,
          3600,
        )
      ).allowed
    )
      return NextResponse.json(
        { error: "Import limit reached." },
        { status: 429 },
      );
    const body = await request.json();
    if (typeof body.url !== "string" || body.url.length > 2048)
      return NextResponse.json(
        { error: "Enter a valid retailer URL." },
        { status: 400 },
      );
    const hosts = (process.env.ASSHOWN_RETAILER_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return NextResponse.json(await importRetailer(body.url, hosts));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
