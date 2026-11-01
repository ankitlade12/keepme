import "server-only";
import { changeRecord, listRecords } from "./records";
export async function paidFeaturesEnabled() {
  if (process.env.ASSHOWN_PAID_FEATURES_ENABLED === "false") return false;
  const control = (await listRecords("operations")).find(
    (r) => r.id === "processing-control",
  );
  return !(control?.data as { paused?: boolean } | undefined)?.paused;
}
export async function recordProcessingConsent(
  owner: string,
  purpose: "interpret" | "translate" | "visual review" | "text extraction",
  model: string,
  assetId?: string,
) {
  const id = crypto.randomUUID();
  await changeRecord(
    id,
    owner,
    "consent",
    () => ({
      purpose,
      model,
      assetId: assetId ?? null,
      at: new Date().toISOString(),
      version: "processing-consent-1",
      scope: "this request only",
    }),
    new Date(Date.now() + 30 * 86400000).toISOString(),
  );
}
