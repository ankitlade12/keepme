export async function readImage(file: File) {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a JPEG or PNG no larger than 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  if (!jpeg && !png)
    throw new Error("The file contents are not a supported JPEG or PNG.");
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > 20_000_000)
    throw new Error("This image exceeds 20 megapixels. Please resize it.");
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the image."));
    r.readAsDataURL(file);
  });
}

// Keep paired processing images below the hosting request-body limit.
export async function processingImage(file: File): Promise<File> {
  await readImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Image processing is unavailable in this browser.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not prepare this photo.")),
        "image/jpeg",
        0.88,
      ),
    );
    if (blob.size > 2 * 1024 * 1024)
      throw new Error("Processing copy is too large. Choose a smaller image.");
    return new File([blob], "processing-copy.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

// Decode local handoffs without fetch, which connect-src correctly restricts.
export function dataImageFile(url: string, name: string): File {
  const prefix = /^data:(image\/(?:png|jpeg));base64,/.exec(url);
  if (!prefix || url.length > Math.ceil((10 * 1024 * 1024) / 3) * 4 + 32)
    throw new Error("Choose a JPEG or PNG no larger than 10 MB.");
  let decoded: string;
  try {
    decoded = atob(url.slice(prefix[0].length));
  } catch {
    throw new Error("The image handoff is not valid base64.");
  }
  if (!decoded.length || decoded.length > 10 * 1024 * 1024)
    throw new Error("Choose a JPEG or PNG no larger than 10 MB.");
  return new File([Uint8Array.from(decoded, (c) => c.charCodeAt(0))], name, {
    type: prefix[1],
  });
}
