import { z } from "zod";
export const regionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});
export const visualObservationsSchema = z.object({
  observations: z
    .array(
      z.object({
        attribute: z.enum(["neckline", "sleeves", "large closure"]),
        sourceDescription: z.string().max(500),
        resultDescription: z.string().max(500),
        sourceVisible: z.boolean(),
        resultVisible: z.boolean(),
        sourceRegion: regionSchema.nullable(),
        resultRegion: regionSchema.nullable(),
        possibleDifference: z.boolean(),
        limitation: z.string().min(1).max(500),
      }),
    )
    .max(3),
});
export type VisualObservation = z.infer<
  typeof visualObservationsSchema
>["observations"][number];
export function assessObservation(o: VisualObservation, validated = false) {
  const valid = (r: VisualObservation["sourceRegion"]) =>
    Boolean(r && r.x + r.width <= 1 && r.y + r.height <= 1);
  const assessable =
    o.sourceVisible &&
    o.resultVisible &&
    valid(o.sourceRegion) &&
    valid(o.resultRegion);
  return {
    ...o,
    status: !assessable
      ? "unassessable"
      : !validated
        ? "manual review required"
        : o.possibleDifference
          ? "possible discrepancy"
          : "no discrepancy in this supported check",
    automatedPass: validated && assessable && !o.possibleDifference,
    limitation: !validated
      ? `Not validated for automated conclusions. ${o.limitation}`
      : o.limitation,
  };
}
