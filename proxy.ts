import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/dashboard(.*)",
    "/signin(.*)",
    "/api/v1/retailer(.*)",
    "/api/v1/sessions(.*)",
    "/__clerk/(.*)",
  ],
};
