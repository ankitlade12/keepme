import {
  revokeCommunityMedia,
  type CommunityMedia,
} from "@/lib/asshown/community-media";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor } from "@/lib/asshown/access";
import { changeRecord, listRecords } from "@/lib/asshown/records";
import {
  contributionSchema,
  personalInfo,
  transition,
  publicContribution,
  type Contribution,
} from "@/lib/asshown/community";
import { originAllowed, consumeRateLimit, digestToken } from "@/lib/security";
export async function GET(request: NextRequest) {
  try {
    const a = await actor(request);
    const all = (await listRecords("contribution")).map(
      (r) => r.data as Contribution,
    );
    return NextResponse.json(
      {
        enabled: process.env.ASSHOWN_COMMUNITY_ENABLED === "true",
        moderator: a.moderator,
        published: all
          .filter((n) => n.status === "published" || n.status === "disputed")
          .map(publicContribution),
        own: all.filter((n) => n.owner === a.owner),
        queue: a.moderator
          ? all
              .filter((n) => n.status === "pending" || n.status === "disputed")
              .sort((a, b) => {
                const prior = (owner: string) =>
                  all.filter(
                    (n) => n.owner === owner && n.status === "published",
                  ).length;
                return (
                  prior(a.owner) - prior(b.owner) ||
                  a.date.localeCompare(b.date)
                );
              })
          : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Community storage is unavailable." },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  try {
    const a = await actor(request);
    if (!a.user || !a.owner)
      return NextResponse.json(
        {
          error:
            "Sign in to submit a contribution so you can manage or withdraw it later.",
        },
        { status: 401 },
      );
    if (process.env.ASSHOWN_COMMUNITY_ENABLED !== "true")
      return NextResponse.json(
        {
          error:
            "Public submissions are paused pending the moderation launch review.",
        },
        { status: 503 },
      );
    const rate = await consumeRateLimit(`contribution:${a.owner}`, 10, 86400);
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Daily contribution limit reached." },
        { status: 429 },
      );
    const parsed = contributionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Confirm the variant, date, and separate publication consent.",
        },
        { status: 400 },
      );
    const input = parsed.data;
    if (
      personalInfo(
        [
          input.title,
          input.retailer,
          input.productId,
          input.color,
          input.size,
          input.text,
        ].join("\n"),
      )
    )
      return NextResponse.json(
        {
          error:
            "Possible personal information found. Redact and review before submitting.",
        },
        { status: 400 },
      );
    const fingerprint = digestToken(
      `${input.productId}:${input.color}:${input.size}:${input.text.toLowerCase().replace(/\s+/g, " ")}`,
    );
    const all = await listRecords("contribution");
    if (all.some((r) => (r.data as Contribution).fingerprint === fingerprint))
      return NextResponse.json(
        {
          error:
            "This report already exists; copied reports are not independent evidence.",
        },
        { status: 409 },
      );
    if (input.mediaId) {
      const media = (await listRecords("community-media", a.owner)).find(
        (r) => r.id === input.mediaId,
      );
      if (
        !media ||
        (media.data as CommunityMedia).revokedAt ||
        (media.data as CommunityMedia).contributionId
      )
        return NextResponse.json(
          { error: "Photo is unavailable or already attached." },
          { status: 400 },
        );
    }
    const id = crypto.randomUUID();
    const note: Contribution = {
      ...input,
      id,
      owner: a.owner,
      status: "pending",
      fingerprint,
      audit: [
        {
          action: "submitted",
          reason: "Contributor approved the public text preview.",
          at: new Date().toISOString(),
        },
      ],
    };
    if (input.mediaId)
      await changeRecord(input.mediaId, a.owner, "community-media", (r) => {
        if (
          !r ||
          (r.data as CommunityMedia).revokedAt ||
          (r.data as CommunityMedia).contributionId
        )
          throw new Error("Photo is unavailable or already attached.");
        return { ...(r.data as CommunityMedia), contributionId: id };
      });
    await changeRecord(id, a.owner, "contribution", () => note);
    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Contribution could not be submitted." },
      { status: 503 },
    );
  }
}
export async function PATCH(request: NextRequest) {
  if (!originAllowed(request))
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  try {
    const a = await actor(request);
    if (!a.owner)
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const p = z
      .object({
        id: z.string().uuid(),
        action: z.enum([
          "publish",
          "dispute",
          "remove",
          "withdraw",
          "appeal",
          "correct",
        ]),
        reason: z.string().min(5).max(2000),
        imageReviewed: z.boolean().optional(),
        replacement: z.string().min(5).max(2000).optional(),
      })
      .safeParse(await request.json());
    if (!p.success)
      return NextResponse.json(
        { error: "An action and specific reason are required." },
        { status: 400 },
      );
    const row = (await listRecords("contribution")).find(
      (r) => r.id === p.data.id,
    );
    if (!row)
      return NextResponse.json(
        { error: "Contribution unavailable." },
        { status: 404 },
      );
    const result = await changeRecord(
      row.id,
      row.owner,
      "contribution",
      (current) => {
        if (!current) throw new Error("Contribution unavailable.");
        return transition(
          {
            ...(current.data as Contribution),
            imageReviewed:
              p.data.action === "publish"
                ? p.data.imageReviewed
                : (current.data as Contribution).imageReviewed,
          },
          p.data.action,
          p.data.reason,
          { owner: a.owner!, moderator: a.moderator },
          p.data.replacement,
        );
      },
    );
    const updated = result?.data as Contribution;
    if (updated.mediaId && updated.status === "withdrawn")
      await revokeCommunityMedia(updated.mediaId, row.owner);
    return NextResponse.json({ status: updated.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
