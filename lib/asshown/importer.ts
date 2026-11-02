import { lookup } from "node:dns/promises";
import https from "node:https";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

export function decodeRetailerBody(bytes: Buffer, encoding = "") {
  const options = { maxOutputLength: 4 * 1024 * 1024 };
  const codec = encoding.trim().toLowerCase();
  const decoded =
    codec === "gzip"
      ? gunzipSync(bytes, options)
      : codec === "deflate"
        ? inflateSync(bytes, options)
        : codec === "br"
          ? brotliDecompressSync(bytes, options)
          : !codec || codec === "identity"
            ? bytes
            : null;
  if (!decoded)
    throw new Error("The retailer returned an unsupported content encoding.");
  if (decoded.length > options.maxOutputLength)
    throw new Error("The retailer page is too large.");
  return decoded.toString("utf8");
}
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
          res.on("error", reject);
          res.on("end", () => {
            try {
              resolve({
                text: decodeRetailerBody(
                  Buffer.concat(chunks),
                  res.headers["content-encoding"],
                ),
                status: res.statusCode ?? 500,
                type: String(res.headers["content-type"] ?? ""),
              });
            } catch (error) {
              reject(error);
            }
          });
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
export function parseAmazonProduct(html: string, asin: string) {
  type Node = DefaultTreeAdapterMap["node"];
  const fields = new Map<string, Node[]>();
  function visit(node: Node) {
    if ("attrs" in node) {
      const id = node.attrs.find((a) => a.name === "id")?.value;
      if (id) fields.set(id, [...(fields.get(id) ?? []), node]);
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  function text(node: Node): string {
    if (node.nodeName === "#text" && "value" in node) return node.value;
    if (
      "tagName" in node &&
      ["script", "style", "noscript"].includes(node.tagName)
    )
      return "";
    return "childNodes" in node ? node.childNodes.map(text).join(" ") : "";
  }
  visit(parse(html));
  const identity = fields.get("ASIN") ?? [];
  if (
    identity.length !== 1 ||
    !("attrs" in identity[0]) ||
    identity[0].attrs.find((a) => a.name === "value")?.value !== asin
  )
    throw new Error(
      "The page does not identify the requested Amazon product. Paste its listing instead.",
    );
  const field = (id: string) =>
    (fields.get(id) ?? []).map(text).join(" ").replace(/\s+/g, " ").trim();
  const title = field("productTitle").slice(0, 150);
  const details =
    field("productFactsDesktop_feature_div") || field("feature-bullets");
  if (!title || !details)
    throw new Error(
      "The page does not contain readable Amazon product details. Paste its listing instead.",
    );
  return {
    title,
    brand: field("bylineInfo")
      .replace(/^Visit the (.+) Store$/, "$1")
      .replace(/^Brand:\s*/, "")
      .slice(0, 150),
    productId: asin,
    text: details.slice(0, 10000),
  };
}

function matchesRobotsPath(pattern: string, path: string) {
  let p = 0,
    t = 0,
    star = -1,
    retry = 0;
  while (t < path.length) {
    if (pattern[p] === path[t]) {
      p++;
      t++;
    } else if (pattern[p] === "*") {
      star = p++;
      retry = t;
    } else if (star !== -1) {
      p = star + 1;
      t = ++retry;
    } else return false;
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
}
export function robotsAllows(text: string, url: URL) {
  if (text.length > 100000 || url.href.length > 2048) return false;
  const groups: Array<{
    agents: string[];
    rules: Array<{ allow: boolean; path: string }>;
  }> = [];
  let group: (typeof groups)[number] | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    const match = /^(user-agent|allow|disallow):\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, directive, value] = match;
    if (directive.toLowerCase() === "user-agent") {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && value)
      group.rules.push({
        allow: directive.toLowerCase() === "allow",
        path: value,
      });
  }
  const agent = "asshownproductimport";
  const score = (g: (typeof groups)[number]) =>
    Math.max(
      -1,
      ...g.agents.map((a) =>
        a === "*" ? 0 : agent.includes(a) ? a.length : -1,
      ),
    );
  const specificity = Math.max(-1, ...groups.map(score));
  const path = url.pathname + url.search;
  let best = -1,
    allowed = true;
  for (const g of groups.filter(
    (g) => score(g) === specificity && specificity >= 0,
  ))
    for (const rule of g.rules) {
      const anchored = rule.path.endsWith("$");
      const pattern = anchored ? rule.path.slice(0, -1) : rule.path + "*";
      if (matchesRobotsPath(pattern, path)) {
        const length = rule.path.replace(/[*$]/g, "").length;
        if (length > best || (length === best && rule.allow)) {
          best = length;
          allowed = rule.allow;
        }
      }
    }
  return allowed;
}
export function amazonProduct(raw: string) {
  const parsed = new URL(raw);
  if (!["amazon.com", "www.amazon.com"].includes(parsed.hostname.toLowerCase()))
    return null;
  permittedUrl(raw, ["amazon.com", "www.amazon.com"]);
  const match = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i.exec(
    parsed.pathname,
  );
  if (!match)
    throw new Error(
      "Use an Amazon product link containing /dp/ or /gp/product/, then confirm its exact color and size.",
    );
  const productId = match[1].toUpperCase();
  return { productId, sourceUrl: `https://www.amazon.com/dp/${productId}` };
}
export async function importRetailer(raw: string, hosts: string[]) {
  const amazon = amazonProduct(raw);
  if (amazon) {
    try {
      return {
        ...(await fetchRetailer(amazon.sourceUrl, ["www.amazon.com"])),
        productId: amazon.productId,
        mode: "imported" as const,
      };
    } catch (error) {
      const detail =
        error instanceof Error &&
        /^(The (retailer|page)|This (retailer|page)) /.test(error.message)
          ? error.message
          : "The retailer could not be reached. Paste the listing instead.";
      return {
        ...amazon,
        mode: "manual" as const,
        title: "",
        brand: "",
        text: "",
        variantConfirmed: false,
        message: `Amazon link saved, but details were not imported. ${detail} Confirm the exact color and size.`,
      };
    }
  }
  return { ...(await fetchRetailer(raw, hosts)), mode: "imported" as const };
}
async function fetchRetailer(raw: string, hosts: string[]) {
  const url = permittedUrl(raw, hosts);
  const robots = await fetchPublic(new URL("/robots.txt", url));
  if (
    robots.status !== 404 &&
    (!robots.type.includes("text/plain") || !robotsAllows(robots.text, url))
  )
    throw new Error(
      "This retailer publishes crawl restrictions. Paste the listing instead.",
    );
  const page = await fetchPublic(url);
  if (page.status !== 200 || !page.type.includes("text/html"))
    throw new Error("This page cannot be imported. Paste the listing instead.");
  return {
    ...(amazonProduct(raw)
      ? parseAmazonProduct(page.text, amazonProduct(raw)!.productId)
      : parseProduct(page.text)),
    sourceUrl: url.href,
    sourceDate: new Date().toISOString(),
    variantConfirmed: false,
  };
}
