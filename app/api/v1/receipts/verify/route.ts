import { NextRequest, NextResponse } from "next/server";
import { verifyReceipt } from "@/lib/receipt-signing";
import { consumeRateLimit, requestFingerprint } from "@/lib/security";

export async function POST(request: NextRequest) {
  const limit = await consumeRateLimit(`receipt-verify:${requestFingerprint(request)}`, 60, 60 * 60);
  if (!limit.allowed) return NextResponse.json({ valid: false, error: "Rate limit reached." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const body = await request.json().catch(() => ({})) as { signature?: string };
  if (!body.signature || body.signature.length > 16_000) return NextResponse.json({ valid: false, error: "A receipt signature is required." }, { status: 400 });
  try {
    const verified = await verifyReceipt(body.signature);
    return NextResponse.json({ valid: true, receiptId: verified.payload.receiptId, contractDigest: verified.payload.contractDigest, resultDigest: verified.payload.resultDigest }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ valid: false }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
