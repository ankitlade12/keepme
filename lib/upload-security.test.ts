// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { sanitizeImage, UploadValidationError } from "./upload-security";

describe("upload sanitization", () => {
  it("decodes and re-encodes allowed image bytes", async () => {
    const input = await sharp({ create: { width: 400, height: 500, channels: 3, background: "#74523d" } }).png().withMetadata({ orientation: 6 }).toBuffer();
    const sanitized = await sanitizeImage(new File([input], "misleading.exe", { type: "application/octet-stream" }), "Image");
    const metadata = await sharp(sanitized.bytes).metadata();
    expect(sanitized.type).toBe("image/jpeg");
    expect(metadata.format).toBe("jpeg");
    expect(metadata.orientation).toBeUndefined();
  });

  it("rejects content that is not a decodable image", async () => {
    await expect(sanitizeImage(new File(["not an image"], "photo.png", { type: "image/png" }), "Image")).rejects.toBeInstanceOf(UploadValidationError);
  });
});
