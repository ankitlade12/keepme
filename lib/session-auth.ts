import "server-only";

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getSession } from "./session-store";
import { retailerAllowlist, serverConfig } from "./server-config";
import { suppliedSessionToken, validSessionToken } from "./security";

export async function authorizedSession(request: NextRequest, id: string) {
  const session = await getSession(id);
  if (!session) return null;
  if (validSessionToken(session.accessTokenDigest, suppliedSessionToken(request))) return session;
  const user = await auth();
  const email = user?.user?.email?.toLowerCase();
  if (email && session.actorId === email) return session;
  return null;
}

export async function currentTenant() {
  const user = await auth();
  const email = user?.user?.email?.toLowerCase() ?? null;
  const tenantId = email?.split("@")[1] ? `org_${email.split("@")[1].replace(/[^a-z0-9.-]/g, "")}` : "public";
  return { tenantId, actorId: email };
}

export async function retailerAuthorized() {
  if (serverConfig.NODE_ENV !== "production" && retailerAllowlist().size === 0) return { authorized: true, demo: true, email: null };
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  const allowlist = retailerAllowlist();
  return { authorized: Boolean(email && allowlist.has(email)), demo: false, email };
}
