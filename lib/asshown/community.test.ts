import { describe, it, expect } from "vitest";
import {
  personalInfo,
  transition,
  publicContribution,
  type Contribution,
} from "./community";
const note: Contribution = {
  id: "1",
  owner: "alice",
  title: "Jacket",
  retailer: "Test",
  productId: "sku",
  color: "rust",
  size: "M",
  confirmed: true,
  text: "The two pockets are functional.",
  date: "2026-11-01T12:00:00Z",
  consent: true,
  status: "pending",
  fingerprint: "hash",
  audit: [],
};
describe("community moderation", () => {
  it("blocks private information", () => {
    expect(personalInfo("Send to 12 Main Street")).toBe(true);
    expect(personalInfo("me@example.com")).toBe(true);
  });
  it("prevents self-publication", () =>
    expect(() =>
      transition(note, "publish", "Looks fine", {
        owner: "alice",
        moderator: false,
      }),
    ).toThrow());
  it("withdrawal cannot be undone by a moderator", () => {
    const withdrawn = transition(note, "withdraw", "No longer sharing", {
      owner: "alice",
      moderator: false,
    });
    expect(() =>
      transition(withdrawn, "publish", "Approved", {
        owner: "moderator",
        moderator: true,
      }),
    ).toThrow();
  });
  it("excludes owner and audit from public representation", () => {
    expect(publicContribution(note)).not.toHaveProperty("owner");
    expect(publicContribution(note)).not.toHaveProperty("audit");
  });
  it("allows disputes without upgrading them to truth", () => {
    expect(
      transition(
        { ...note, status: "published" },
        "dispute",
        "Different item received",
        { owner: "bob", moderator: false },
      ).status,
    ).toBe("disputed");
  });
});

it("does not expose a pending private report through a dispute", () => {
  expect(() =>
    transition(note, "dispute", "Needs review", {
      owner: "other",
      moderator: false,
    }),
  ).toThrow("Only published");
});
it("checks private information in product metadata before publication", () => {
  expect(() =>
    transition(
      { ...note, title: "Email me@example.com" },
      "publish",
      "Reviewed",
      { owner: "mod", moderator: true },
    ),
  ).toThrow();
});

it("requires explicit moderator image review before publication", () => {
  expect(() =>
    transition(
      { ...note, mediaId: "00000000-0000-4000-8000-000000000001" },
      "publish",
      "Reviewed",
      { owner: "mod", moderator: true },
    ),
  ).toThrow("image review");
});
it("corrections preserve prior text and return to moderation", () => {
  const result = transition(
    { ...note, status: "published" },
    "correct",
    "Correcting an observation",
    { owner: "alice", moderator: false },
    "The inner pockets are decorative.",
  );
  expect(result.status).toBe("pending");
  expect(result.revisions?.[0].text).toBe(note.text);
  expect(result.text).toContain("decorative");
});
