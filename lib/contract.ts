import { z } from "zod";
import type { ContractProtection, IdentityContract } from "./types";

export const defaultProtections: ContractProtection[] = [
  {
    id: "face_geometry",
    label: "Face shape",
    description: "Checks facial landmarks for unexpected movement.",
    enabled: true,
  },
  {
    id: "skin_appearance",
    label: "Skin appearance",
    description: "Compares visible skin and eligible Skin AI signals.",
    enabled: true,
  },
  {
    id: "hair",
    label: "Hair",
    description: "Flags edits to hair outside the garment boundary.",
    enabled: true,
  },
  {
    id: "background",
    label: "Background",
    description: "Detects material changes to the surrounding scene.",
    enabled: true,
  },
  {
    id: "glasses",
    label: "Glasses",
    description: "Treats eyewear as a protected personal object.",
    enabled: true,
  },
];

export const identityContractSchema = z.object({
  contractId: z.string().min(1),
  contractVersion: z.literal("1.0"),
  sessionId: z.string().min(1),
  garmentCategory: z.literal("upper_body"),
  garment: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    source: z.enum(["catalog", "upload"]),
  }).optional(),
  protections: z.array(
    z.object({
      id: z.enum(["face_geometry", "skin_appearance", "hair", "background", "glasses"]),
      label: z.string(),
      description: z.string(),
      enabled: z.boolean(),
    }),
  ),
  customZones: z.array(
    z.object({
      zoneId: z.string(),
      label: z.string().nullable(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
      critical: z.boolean(),
    }),
  ),
  thresholdProfile: z.literal("mvp_conservative_v1"),
  retention: z.object({
    original: z.literal("session_only"),
    generated: z.literal("session_only"),
    receipt: z.literal("user_choice"),
    analytics: z.literal("anonymous_events_only"),
  }),
  consentedAt: z.string().datetime().nullable(),
});

export function createContract(sessionId: string): IdentityContract {
  return {
    contractId: `ic_${crypto.randomUUID().slice(0, 8)}`,
    contractVersion: "1.0",
    sessionId,
    garmentCategory: "upper_body",
    garment: { id: "rust-utility", name: "Rust utility jacket", source: "catalog" },
    protections: defaultProtections.map((protection) => ({ ...protection })),
    customZones: [],
    thresholdProfile: "mvp_conservative_v1",
    retention: {
      original: "session_only",
      generated: "session_only",
      receipt: "user_choice",
      analytics: "anonymous_events_only",
    },
    consentedAt: null,
  };
}
