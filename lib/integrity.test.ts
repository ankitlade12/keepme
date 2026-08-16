import { describe, expect, it } from "vitest";
import { decideState, scoreIntegrity } from "./integrity";
import { compliantSignals, repairedSignals, violationSignals } from "./demo";

describe("integrity decision policy", () => {
  it("passes a high-confidence compliant result", () => {
    expect(decideState(compliantSignals)).toBe("passed");
    expect(scoreIntegrity(compliantSignals)).toBeGreaterThan(0.9);
  });

  it("hard-fails a critical preserve-zone violation", () => {
    expect(decideState(violationSignals)).toBe("failed");
  });

  it("marks a compliant repaired result distinctly", () => {
    expect(decideState(repairedSignals)).toBe("passed_after_repair");
  });

  it("returns inconclusive when alignment is unreliable", () => {
    expect(decideState({ ...compliantSignals, alignmentReliable: false })).toBe("inconclusive");
  });

  it("requires review when a preserve zone misses the component pass threshold", () => {
    expect(decideState({ ...compliantSignals, preserveZone: 0.78 })).toBe("needs_review");
  });

  it("fails a provider no-op even when protected regions are stable", () => {
    expect(decideState({ ...compliantSignals, garmentFidelity: 0.12 })).toBe("failed");
  });
});
