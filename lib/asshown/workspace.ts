import { z } from "zod";
import { productSchema, requirementSchema, sourceSchema } from "./policy";
const claimSchema = z.object({
  attribute: requirementSchema.shape.attribute,
  value: z.string(),
  quote: z.string(),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  source: sourceSchema,
});
const findingSchema = z.object({
  requirement: requirementSchema,
  state: z.enum(["supported", "conflicts", "unknown", "conflicting evidence"]),
  claims: z.array(claimSchema),
  reason: z.string(),
});
export const reportSchema = z.object({
  createdAt: z.string().datetime(),
  policyVersion: z.string(),
  requirementVersion: z.number().int().positive(),
  requirements: z.array(requirementSchema).max(5),
  products: z
    .array(
      productSchema
        .omit({ image: true, images: true })
        .extend({ findings: z.array(findingSchema), outcome: z.string() }),
    )
    .max(3),
  photoStatus: z.string(),
  limitation: z.string(),
});
export const savedSchema = z.object({
  id: z.string().uuid(),
  date: z.string().datetime(),
  data: reportSchema,
});
export const workspaceSchema = z.object({
  products: z.array(productSchema.omit({ image: true, images: true })).max(3),
  requirements: z.array(requirementSchema).max(5),
  version: z.number().int().positive(),
  profiles: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        requirements: z.array(requirementSchema).max(5),
      }),
    )
    .max(20),
  history: z.array(savedSchema).max(50),
});
export type WorkspaceSnapshot = z.infer<typeof workspaceSchema>;
