import sharp from "sharp";
import path from "node:path";

const root = process.cwd();
const targetPath = path.join(root, "public/demo/youcam-live-tryon.jpg");
const glassesRemovedPath = path.join(root, "public/demo/controlled-glasses-violation.png");
const outputPath = path.join(root, "public/demo/controlled-glasses-violation-v5.png");

const target = sharp(targetPath).rotate();
const metadata = await target.metadata();
if (!metadata.width || !metadata.height) throw new Error("Target fixture dimensions are unavailable.");

// The image edit removed the glasses but slightly changed framing. Normalize it
// to the live VTO dimensions, then composite only the aligned eye region so the
// controlled fixture differs nowhere else.
const patchBox = { left: 400, top: 260, width: 286, height: 110 };
const destinationTop = patchBox.top;
const normalizedEdit = await sharp(glassesRemovedPath)
  .rotate()
  .resize(metadata.width, metadata.height, { fit: "fill" })
  .extract(patchBox)
  .ensureAlpha()
  .toBuffer();
const inset = 5;
const mask = Buffer.from(`<svg width="${patchBox.width}" height="${patchBox.height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${patchBox.width / 2}" cy="${patchBox.height / 2}" rx="${patchBox.width / 2 - inset}" ry="${patchBox.height / 2 - inset}" fill="white"/></svg>`);
const maskedPatch = await sharp(normalizedEdit).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

await sharp(targetPath)
  .rotate()
  .composite([{ input: maskedPatch, left: patchBox.left, top: destinationTop }])
  .png()
  .toFile(outputPath);

console.log(path.relative(root, outputPath));
