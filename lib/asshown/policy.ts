import { z } from "zod";

export const attributes = [
  "care",
  "sleeves",
  "pockets",
  "closure",
  "material",
  "price",
  "custom",
] as const;
export const requirementSchema = z.object({
  id: z.string().min(1),
  attribute: z.enum(attributes),
  value: z.string().min(1).max(200),
  importance: z.enum(["essential", "preferred"]),
  wording: z.string().max(300),
});
export const sourceSchema = z.object({
  id: z.string(),
  excluded: z.boolean().optional(),
  correctionReason: z.string().max(1000).optional(),
  communityId: z.string().uuid().optional(),
  communityStatus: z.enum(["published", "unavailable"]).optional(),
  kind: z.enum([
    "seller listing",
    "seller reply",
    "user observation",
    "community report",
  ]),
  text: z.string().max(12000),
  date: z.string(),
  variant: z.string(),
});
export const productSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(150),
  brand: z.string().max(100),
  retailer: z.string().max(150),
  sku: z.string().max(150).optional(),
  color: z.string().max(80),
  size: z.string().max(40),
  confirmed: z.boolean(),
  sources: z.array(sourceSchema).max(20),
  assetIds: z.array(z.string().uuid()).max(3).optional(),
  image: z.string().optional(),
  images: z.array(z.string()).max(3).optional(),
  decision: z
    .enum(["undecided", "shortlist", "information", "removed"])
    .default("undecided"),
});
export type Requirement = z.infer<typeof requirementSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Product = z.infer<typeof productSchema>;
export type State =
  | "supported"
  | "conflicts"
  | "unknown"
  | "conflicting evidence";
export type Claim = {
  attribute: Requirement["attribute"];
  value: string;
  quote: string;
  start: number;
  end: number;
  source: Source;
};
export type Finding = {
  requirement: Requirement;
  state: State;
  claims: Claim[];
  reason: string;
};
export const policyVersion = "asshown-conservative-1";
export const defaults: Requirement[] = [
  {
    id: "care",
    attribute: "care",
    value: "machine wash",
    wording: "Machine washable",
    importance: "essential",
  },
  {
    id: "sleeves",
    attribute: "sleeves",
    value: "long sleeves",
    wording: "Full-length sleeves",
    importance: "essential",
  },
  {
    id: "pockets",
    attribute: "pockets",
    value: "functional pockets",
    wording: "Functional pockets",
    importance: "essential",
  },
];
export function variant(p: Pick<Product, "color" | "size">) {
  return `${p.color.trim()} / ${p.size.trim()}`;
}
// Only explicit phrases are extracted. Unrecognized language remains unknown for user review.
const rules: Array<[Requirement["attribute"], string, RegExp]> = [
  [
    "care",
    "not machine wash",
    /\b(?:do not machine wash|not machine washable|dry[ -]clean only|hand wash only)\b/gi,
  ],
  [
    "care",
    "machine wash",
    /\bmachine wash(?:able)?(?: cold| warm| gentle)?\b/gi,
  ],
  [
    "sleeves",
    "long sleeves",
    /\b(?:long[ -]sleeve[ds]?|full[ -]length sleeves)\b/gi,
  ],
  ["sleeves", "short sleeves", /\bshort[ -]sleeve[ds]?\b/gi],
  ["sleeves", "sleeveless", /\bsleeveless\b/gi],
  [
    "pockets",
    "functional pockets",
    /\b(?:functional|working|usable) pockets\b/gi,
  ],
  [
    "pockets",
    "no functional pockets",
    /\b(?:no pockets|decorative pockets|non[ -]functional pockets|faux pockets)\b/gi,
  ],
  ["closure", "zipper", /\b(?:zipper|zip[ -]front|zip closure)\b/gi],
  [
    "closure",
    "buttons",
    /\b(?:button[ -]front|button closure|functional buttons)\b/gi,
  ],
  ["closure", "no buttons", /\b(?:no buttons|button[ -]free)\b/gi],
  [
    "material",
    "composition",
    /\b\d{1,3}(?:\.\d+)?%\s*(?:cotton|polyester|linen|wool|elastane|nylon|viscose|silk)\b/gi,
  ],
  ["price", "USD", /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?/g],
];
export function extract(source: Source): Claim[] {
  const found: Claim[] = [];
  for (const [attribute, value, expression] of rules) {
    for (const match of source.text.matchAll(expression)) {
      const start = match.index!;
      const prefix = source.text.slice(Math.max(0, start - 20), start);
      if (value === "machine wash" && /(?:do not |not )$/i.test(prefix))
        continue;
      if (
        value === "functional pockets" &&
        /(?:non[ -]|no |not )$/i.test(prefix)
      )
        continue;
      // Negated positive phrases cannot support a requirement.
      if (/\b(?:not|no|without)\s+(?:any\s+)?$/i.test(prefix)) continue;
      found.push({
        attribute,
        value: attribute === "material" ? match[0].toLowerCase() : value,
        quote: match[0],
        start,
        end: start + match[0].length,
        source,
      });
    }
  }
  return found;
}
export function evaluate(
  product: Product,
  requirements: Requirement[],
): Finding[] {
  const claims = product.sources
    .filter(
      (s) =>
        s.variant === variant(product) &&
        !s.excluded &&
        (!s.communityId || s.communityStatus === "published"),
    )
    .flatMap(extract);
  return requirements.map((requirement) => {
    const relevant = claims.filter(
      (c) => c.attribute === requirement.attribute,
    );
    if (!product.confirmed)
      return {
        requirement,
        state: "unknown",
        claims: [],
        reason: "Confirm the exact color and size before using this evidence.",
      };
    if (requirement.attribute === "custom")
      return {
        requirement,
        state: "unknown",
        claims: [],
        reason:
          "This requirement needs a direct evidence review; no automatic interpretation was made.",
      };
    if (!relevant.length)
      return {
        requirement,
        state: "unknown",
        claims: [],
        reason:
          "No explicit, variant-matched statement found. A photo or generated preview cannot establish this property.",
      };
    const matches = relevant.map((c) => {
      if (requirement.attribute === "price") {
        const budget = Number(requirement.value);
        return Number.isFinite(budget) && budget > 0
          ? Number(c.quote.replace(/[$,\s]/g, "")) <= budget
          : null;
      }
      if (requirement.attribute === "material") {
        const requested = requirement.value.trim().toLowerCase();
        if (c.value === requested) return true;
        const wanted = requested.match(/^(\d+(?:\.\d+)?)%\s*(\w+)$/);
        const stated = c.value.match(/^(\d+(?:\.\d+)?)%\s*(\w+)$/);
        if (!wanted || !stated || Number(stated[1]) > 100) return null;
        if (wanted[2] === stated[2]) return false;
        return Number(wanted[1]) === 100 && Number(stated[1]) > 0
          ? false
          : null;
      }
      if (requirement.attribute === "closure") {
        if (c.value === requirement.value) return true;
        if (
          (requirement.value === "no buttons" && c.value === "buttons") ||
          (requirement.value === "buttons" && c.value === "no buttons")
        )
          return false;
        return null;
      }
      return c.value === requirement.value;
    });
    const yes = matches.includes(true),
      no = matches.includes(false);
    const state: State =
      yes && no
        ? "conflicting evidence"
        : yes
          ? "supported"
          : no
            ? "conflicts"
            : "unknown";
    return {
      requirement,
      state,
      claims: relevant,
      reason:
        state === "supported"
          ? "Supported by the quoted statement; not independently confirmed."
          : state === "conflicts"
            ? "The source states a different attribute from your requirement."
            : state === "conflicting evidence"
              ? "Sources disagree. Both statements are retained for clarification."
              : "The available statement does not establish your exact requirement.",
    };
  });
}
export function outcome(findings: Finding[]) {
  const essentials = findings.filter(
    (f) => f.requirement.importance === "essential",
  );
  if (essentials.some((f) => f.state === "conflicts"))
    return "Essential conflict";
  if (essentials.some((f) => f.state !== "supported"))
    return "Needs more information";
  return "Essentials supported by sources";
}
export function sellerQuestion(product: Product, findings: Finding[]) {
  const unresolved =
    findings.find(
      (f) =>
        f.requirement.importance === "essential" && f.state !== "supported",
    ) ?? findings.find((f) => f.state !== "supported");
  if (!unresolved)
    return "All current requirements have source support. You can still ask the seller to confirm the exact variant.";
  return `Hello, I’m considering ${product.title} (${variant(product)}). Could you confirm whether this exact variant meets this requirement: “${unresolved.requirement.wording}”? Please share the relevant care label, construction detail, or a close-up. Thank you.`;
}
export function decisionRecord(
  products: Product[],
  requirements: Requirement[],
  version: number,
) {
  return {
    createdAt: new Date().toISOString(),
    policyVersion,
    requirementVersion: version,
    requirements,
    products: products.map((p) => ({
      ...p,
      image: undefined,
      images: undefined,
      findings: evaluate(p, requirements),
      outcome: outcome(evaluate(p, requirements)),
    })),
    photoStatus: "Photos omitted from this report.",
    limitation:
      "Seller statements are not independent confirmation. Generated previews do not prove fit, comfort, material, or pocket function.",
  };
}
