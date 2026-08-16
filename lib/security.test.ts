// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { digestToken, originAllowed, validSessionToken } from "./security";

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
});
