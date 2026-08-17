import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkConfigured } from "@/lib/clerk-config";

const configuredClerkMiddleware = clerkConfigured() ? clerkMiddleware() : null;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!configuredClerkMiddleware) return NextResponse.next();
  return configuredClerkMiddleware(request, event);
}

export const config = {
  matcher: [
    "/dashboard(.*)",
    "/signin(.*)",
    "/api/v1/retailer(.*)",
    "/api/v1/sessions(.*)",
    "/__clerk/(.*)",
  ],
};
