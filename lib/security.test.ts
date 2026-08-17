// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { digestToken, originAllowed, validSecret, validSessionToken } from "./security";

describe("security boundaries", () => {
  it("compares opaque session capabilities by digest", () => {
    const digest = digestToken("correct-capability");
    expect(validSessionToken(digest, "correct-capability")).toBe(true);
    expect(validSessionToken(digest, "wrong-capability")).toBe(false);
    expect(validSessionToken(digest, undefined)).toBe(false);
  });

  it("rejects cross-origin mutations", () => {
    expect(originAllowed(new NextRequest("https://keepme.example/api", { headers: { Origin: "https://attacker.example" } }))).toBe(false);
    expect(originAllowed(new NextRequest("https://keepme.example/api", { headers: { Origin: "https://keepme.example" } }))).toBe(true);
  });

  it("compares maintenance credentials without plain-text equality", () => {
    expect(validSecret("correct-secret", "correct-secret")).toBe(true);
    expect(validSecret("correct-secret", "wrong-secret")).toBe(false);
    expect(validSecret(undefined, "correct-secret")).toBe(false);
  });
});
