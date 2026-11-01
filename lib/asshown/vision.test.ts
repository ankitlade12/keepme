import { describe, it, expect } from "vitest";
import { assessObservation, type VisualObservation } from "./vision";
const base: VisualObservation = {
  attribute: "sleeves",
  sourceDescription: "Long",
  resultDescription: "Short",
  sourceVisible: true,
  resultVisible: true,
  sourceRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
  resultRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
  possibleDifference: true,
  limitation: "Coarse category only.",
};
describe("visual abstention policy", () => {
  it("never promotes unvalidated observations to an automated pass", () =>
    expect(
      assessObservation({ ...base, possibleDifference: false }).automatedPass,
    ).toBe(false));
  it("abstains on occluded regions", () =>
    expect(
      assessObservation({ ...base, resultVisible: false }, true).status,
    ).toBe("unassessable"));
  it("rejects regions extending outside an image", () =>
    expect(
      assessObservation(
        { ...base, sourceRegion: { x: 0.8, y: 0, width: 0.4, height: 0.5 } },
        true,
      ).status,
    ).toBe("unassessable"));
});
