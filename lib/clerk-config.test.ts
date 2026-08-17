import { describe, expect, it } from "vitest";
import { clerkConfigured } from "./clerk-config";

describe("clerkConfigured", () => {
  it("requires both Clerk keys", () => {
    expect(clerkConfigured({})).toBe(false);
    expect(clerkConfigured({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example" })).toBe(false);
    expect(clerkConfigured({ CLERK_SECRET_KEY: "sk_test_example" })).toBe(false);
    expect(clerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
    })).toBe(true);
  });

  it("rejects blank keys", () => {
    expect(clerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " ",
      CLERK_SECRET_KEY: "sk_test_example",
    })).toBe(false);
  });
});
