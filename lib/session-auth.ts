import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getSession } from "./session-store";
import { retailerAllowlist, serverConfig } from "./server-config";
import { suppliedSessionToken, validSessionToken } from "./security";

function tenantFor(userId: string | null | undefined, orgId: string | null | undefined) {
  if (orgId) return `org_${orgId}`;
  if (userId) return `user_${userId}`;
  return "public";
}

export async function authorizedSession(request: NextRequest, id: string) {
  const session = await getSession(id);
  if (!session) return null;
  if (validSessionToken(session.accessTokenDigest, suppliedSessionToken(request))) return session;
  const { userId } = await auth();
  if (userId && session.actorId === userId) return session;
  return null;
}

export async function currentTenant() {
  const { userId, orgId } = await auth();
  return { tenantId: tenantFor(userId, orgId), actorId: userId };
}

export async function retailerAuthorized() {
  if (serverConfig.NODE_ENV !== "production" && retailerAllowlist().size === 0) {
    return { authorized: true, demo: true, email: null, tenantId: "public" };
  }
  const { userId, orgId } = await auth();
  if (!userId) return { authorized: false, demo: false, email: null, tenantId: null };
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress.toLowerCase() ?? null;
  const allowlist = retailerAllowlist();
  return {
    authorized: Boolean(email && allowlist.has(email)),
    demo: false,
    email,
    tenantId: tenantFor(userId, orgId),
  };
}
