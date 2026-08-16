// @vitest-environment node
import { describe, expect, it } from "vitest";
import { signReceipt, verifyReceipt } from "./receipt-signing";

describe("receipt signing", () => {
  it("verifies untampered receipt evidence", async () => {
    const signature = await signReceipt({ receiptId: "KM-TEST", contractDigest: "abc", resultDigest: "def" });
    const verified = await verifyReceipt(signature);
    expect(verified.payload.receiptId).toBe("KM-TEST");
  });

  it("rejects a tampered signature", async () => {
    const signature = await signReceipt({ receiptId: "KM-TEST", contractDigest: "abc", resultDigest: "def" });
    const parts = signature.split(".");
    parts[1] = `${parts[1].slice(0, 10)}${parts[1][10] === "A" ? "B" : "A"}${parts[1].slice(11)}`;
    await expect(verifyReceipt(parts.join("."))).rejects.toThrow();
  });
});
