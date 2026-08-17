import "server-only";

import sharp, { type Metadata } from "sharp";
import { serverConfig } from "./server-config";
import { productionSafetyRequired } from "./runtime-capabilities";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const SCANNER_RETRY_ATTEMPTS = 30;

export class UploadValidationError extends Error {}
export class UploadSecurityUnavailableError extends Error {}

export async function sanitizeImage(value: FormDataEntryValue | null, label: string) {
  if (!(value instanceof File)) throw new UploadValidationError(`${label} is required.`);
  if (!value.size || value.size > MAX_FILE_SIZE) throw new UploadValidationError(`${label} must be between 1 byte and 10 MB.`);
  const input = new Uint8Array(await value.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning" }).metadata();
  } catch {
    throw new UploadValidationError(`${label} is not a safe, decodable image.`);
  }
  if (!metadata.width || !metadata.height || !["jpeg", "png"].includes(metadata.format ?? "")) throw new UploadValidationError(`${label} must contain valid JPEG or PNG bytes.`);
  if (metadata.width < 320 || metadata.height < 320) throw new UploadValidationError(`${label} must be at least 320 × 320 pixels.`);
  if (metadata.width * metadata.height > MAX_PIXELS) throw new UploadValidationError(`${label} exceeds the 24-megapixel safety limit.`);
  await scanForMalware(input, label);
  const bytes = await sharp(input, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return { name: "keepme-sanitized.jpg", size: bytes.byteLength, type: "image/jpeg", bytes: new Uint8Array(bytes), width: metadata.width, height: metadata.height };
}

export async function scanForMalware(bytes: Uint8Array, label: string, waitForRetry: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1_000))) {
  if (!serverConfig.MALWARE_SCAN_URL) {
    if (productionSafetyRequired()) throw new UploadSecurityUnavailableError("Live uploads are temporarily unavailable while image safety services are being configured.");
    return;
  }

  for (let attempt = 1; attempt <= SCANNER_RETRY_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(serverConfig.MALWARE_SCAN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", ...(serverConfig.MALWARE_SCAN_TOKEN ? { Authorization: `Bearer ${serverConfig.MALWARE_SCAN_TOKEN}` } : {}) },
        body: Buffer.from(bytes),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      if (attempt < SCANNER_RETRY_ATTEMPTS) { await waitForRetry(); continue; }
      throw new UploadSecurityUnavailableError("Live uploads are temporarily unavailable because the image safety service could not complete.");
    }

    if ([502, 503, 504].includes(response.status) && attempt < SCANNER_RETRY_ATTEMPTS) {
      await waitForRetry();
      continue;
    }
    if (!response.ok) throw new UploadSecurityUnavailableError("Live uploads are temporarily unavailable because the image safety service could not complete.");

    const result = await response.json().catch(() => null) as { clean?: boolean } | null;
    if (result?.clean === true) return;
    if (result?.clean === false) throw new UploadValidationError(`${label} did not pass the malware scan.`);
    throw new UploadSecurityUnavailableError("Live uploads are temporarily unavailable because the image safety service returned an invalid decision.");
  }
  throw new UploadSecurityUnavailableError("Live uploads are temporarily unavailable because the image safety service could not complete.");
}
