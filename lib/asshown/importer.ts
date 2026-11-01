import { lookup } from "node:dns/promises";
import https from "node:https";
export function permittedUrl(raw: string, hosts: string[]) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    (u.port && u.port !== "443") ||
    u.username ||
    u.password ||
    !hosts.includes(u.hostname.toLowerCase())
  )
    throw new Error(
      "This retailer is not supported. Upload images and paste the listing instead.",
    );
  return u;
}
export function publicIPv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0)
  );
}
async function fetchPublic(url: URL) {
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIPv4(a.address)))
    throw new Error("The retailer address is not public.");
  const address = addresses[0].address;
  return new Promise<{ text: string; status: number; type: string }>(
    (resolve, reject) => {
      const req = https.request(
        url,
        {
          method: "GET",
          family: 4,
          headers: {
            "User-Agent": "AsShownProductImport/1.0",
            Accept: "text/html,text/plain",
          },
          lookup: ((
            _host: unknown,
            _opts: unknown,
            cb: (e: null, a: string, f: number) => void,
          ) => cb(null, address, 4)) as never,
        },
        (res) => {
          if ((res.statusCode ?? 500) >= 300 && res.statusCode !== 404) {
            res.resume();
            reject(
              new Error(
                "The retailer blocked or redirected this request. Paste the listing instead.",
              ),
            );
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1024 * 1024) {
              req.destroy(new Error("The retailer page is too large."));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              text: Buffer.concat(chunks).toString("utf8"),
              status: res.statusCode ?? 500,
              type: String(res.headers["content-type"] ?? ""),
            }),
          );
        },
      );
      req.setTimeout(8000, () =>
        req.destroy(new Error("The retailer did not respond in time.")),
      );
      req.on("error", reject);
      req.end();
    },
  );
}
export function parseProduct(html: string) {
  const candidates: Record<string, unknown>[] = [];
  function visit(v: unknown) {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (
        o["@type"] === "Product" ||
        (Array.isArray(o["@type"]) && o["@type"].includes("Product"))
      )
        candidates.push(o);
      if (o["@graph"]) visit(o["@graph"]);
    }
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(m[1]));
    } catch {}
  }
  if (candidates.length !== 1)
    throw new Error(
      "The page does not identify one unambiguous product. Paste its listing instead.",
    );
  const p = candidates[0];
  const plain = (v: unknown) =>
    typeof v === "string" ? v.replace(/<[^>]*>/g, " ").slice(0, 10000) : "";
  return {
    title: plain(p.name).slice(0, 150),
    brand: plain(
      typeof p.brand === "object" && p.brand
        ? (p.brand as Record<string, unknown>).name
        : p.brand,
    ),
    productId: plain(p.sku),
    text: [
      plain(p.description),
      p.material ? `Material: ${plain(p.material)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
export async function importRetailer(raw: string, hosts: string[]) {
  const url = permittedUrl(raw, hosts);
  const robots = await fetchPublic(new URL("/robots.txt", url));
  if (
    robots.status !== 404 &&
    robots.text.split("\n").some((l) => /^\s*Disallow:\s*\S/i.test(l))
  )
    throw new Error(
      "This retailer publishes crawl restrictions. Paste the listing instead.",
    );
  const page = await fetchPublic(url);
  if (page.status !== 200 || !page.type.includes("text/html"))
    throw new Error("This page cannot be imported. Paste the listing instead.");
  return {
    ...parseProduct(page.text),
    sourceUrl: url.href,
    sourceDate: new Date().toISOString(),
    variantConfirmed: false,
  };
}
