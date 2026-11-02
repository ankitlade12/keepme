import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { clerkConfigured } from "../clerk-config";
import { digestToken } from "../security";
import type { NextRequest } from "next/server";
export async function actor(request: NextRequest) {
  const user = clerkConfigured() ? (await auth()).userId : null;
  const guest = request.cookies.get("asshown_guest")?.value;
  const owner = user
    ? `account:${user}`
    : guest && /^[a-f0-9]{64}$/.test(guest)
      ? `guest:${digestToken(guest)}`
      : null;
  const allowedEmails =
    process.env.ASSHOWN_MODERATOR_EMAILS?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const profile = user && allowedEmails.length ? await currentUser() : null;
  const emailModerator = Boolean(
    profile?.emailAddresses.some(
      (e) =>
        e.verification?.status === "verified" &&
        allowedEmails.includes(e.emailAddress.toLowerCase()),
    ),
  );
  return {
    owner,
    user,
    moderator: Boolean(
      emailModerator ||
        (user &&
          process.env.ASSHOWN_MODERATOR_IDS?.split(",")
            .map((s) => s.trim())
            .includes(user)),
    ),
    accountAvailable: clerkConfigured(),
  };
}
