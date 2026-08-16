import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session-store";
import { currentTenant } from "@/lib/session-auth";
import { consumeRateLimit, digestToken, originAllowed, requestFingerprint, secureToken } from "@/lib/security";
import { recordEvent } from "@/lib/observability";
import { enqueueJob } from "@/lib/job-queue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const fingerprint = requestFingerprint(request);
  const limit = await consumeRateLimit(`session-create:${fingerprint}`, 20, 60 * 60);
  if (!limit.allowed) return NextResponse.json({ error: "Too many sessions. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const accessToken = secureToken();
  const identity = await currentTenant();
  const session = await createSession({ ...identity, accessTokenDigest: digestToken(accessToken) });
  await enqueueJob({ tenantId: session.tenantId, sessionId: session.id, kind: "session_cleanup", payload: {} }, new Date(session.expiresAt));
  await recordEvent(session.tenantId, session.id, "session", "created", { expiresInMinutes: Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 60_000) });
  const response = NextResponse.json(
    {
      sessionId: session.id,
      stage: session.stage,
      expiresAt: session.expiresAt,
      retention: "session_only",
    },
    { status: 201, headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(limit.remaining) } },
  );
  response.cookies.set(process.env.NODE_ENV === "production" ? "__Host-keepme_session" : "keepme_session", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: Math.max(1, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 1000)) });
  return response;
}
