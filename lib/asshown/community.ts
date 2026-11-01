import { z } from "zod";
export const contributionSchema = z.object({
  title: z.string().min(2).max(150),
  retailer: z.string().max(150),
  productId: z.string().min(1).max(150),
  color: z.string().min(1).max(80),
  size: z.string().min(1).max(40),
  confirmed: z.boolean(),
  text: z.string().min(5).max(2000),
  date: z.string().datetime(),
  consent: z.literal(true),
  mediaId: z.string().uuid().optional(),
});
export type Contribution = z.infer<typeof contributionSchema> & {
  id: string;
  owner: string;
  status: "pending" | "published" | "disputed" | "removed" | "withdrawn";
  audit: Array<{ action: string; reason: string; at: string }>;
  appeal?: string;
  fingerprint: string;
  imageReviewed?: boolean;
  revisions?: Array<{ text: string; at: string; reason: string }>;
};
export function personalInfo(text: string) {
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b|\b\d+\s+[^\n,]{0,40}\b(?:street|st|road|rd|avenue|ave|drive|lane)\b|\b(?:order|tracking|account)\s*(?:number|no\.?|#|id)\s*[:#]?\s*\w+/i.test(
    text,
  );
}
export function transition(
  note: Contribution,
  action: "publish" | "dispute" | "remove" | "withdraw" | "appeal" | "correct",
  reason: string,
  actor: { owner: string; moderator: boolean },
  replacement?: string,
): Contribution {
  if (!reason.trim())
    throw new Error("A reason is required for the audit record.");
  if ((action === "publish" || action === "remove") && !actor.moderator)
    throw new Error("Moderator access required.");
  if (
    (action === "withdraw" || action === "appeal" || action === "correct") &&
    actor.owner !== note.owner
  )
    throw new Error("Only the contributor can perform this action.");
  if (note.status === "withdrawn")
    throw new Error("Withdrawn evidence cannot be republished.");
  if (
    action === "dispute" &&
    note.status !== "published" &&
    note.status !== "disputed"
  )
    throw new Error("Only published reports can be disputed.");
  if (action === "publish" && note.mediaId && !note.imageReviewed)
    throw new Error("Explicit moderator image review is required.");
  if (
    action === "publish" &&
    (personalInfo(
      [
        note.title,
        note.retailer,
        note.productId,
        note.color,
        note.size,
        note.text,
      ].join("\n"),
    ) ||
      !note.consent ||
      !note.confirmed)
  )
    throw new Error(
      "Personal information or missing consent blocks publication.",
    );
  if (action === "appeal" && note.status !== "removed")
    throw new Error("Only removed contributions can be appealed.");
  if (
    action === "correct" &&
    (!replacement ||
      replacement.trim().length < 5 ||
      replacement.length > 2000 ||
      personalInfo(replacement))
  )
    throw new Error(
      "A correction needs reviewed text without personal information.",
    );
  return {
    ...note,
    text: action === "correct" ? replacement! : note.text,
    revisions:
      action === "correct"
        ? [
            ...(note.revisions ?? []),
            { text: note.text, at: new Date().toISOString(), reason },
          ]
        : note.revisions,
    status:
      action === "publish"
        ? "published"
        : action === "dispute"
          ? "disputed"
          : action === "remove"
            ? "removed"
            : action === "withdraw"
              ? "withdrawn"
              : "pending",
    appeal: action === "appeal" ? reason : note.appeal,
    audit: [...note.audit, { action, reason, at: new Date().toISOString() }],
  };
}
export function publicContribution(note: Contribution) {
  return {
    id: note.id,
    title: note.title,
    retailer: note.retailer,
    productId: note.productId,
    color: note.color,
    size: note.size,
    confirmed: note.confirmed,
    text: note.text,
    date: note.date,
    status: note.status,
    hasImage: Boolean(
      note.mediaId && note.imageReviewed && note.status === "published",
    ),
    sourceClass: "Contributor report",
    limitation:
      "Moderation is not product certification. Reports are not independent proof.",
  };
}
