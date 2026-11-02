import { describe, expect, it } from "vitest";
import { evidencePackage, type EvidenceAttachment } from "./evidence-package";
import { examples } from "./examples";
describe("private evidence package", () => {
  const image: EvidenceAttachment = {
    id: "1",
    name: "<receipt>",
    kind: "receipt",
    image: "data:image/png;base64,YQ==",
    selected: true,
    note: "Only selected evidence",
  };
  it("escapes untrusted text and includes only selected attachments", () => {
    const html = evidencePackage(examples()[0], "<script>alert(1)</script>", [
      image,
      { ...image, id: "2", name: "PRIVATE_UNSELECTED", selected: false },
    ]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;receipt&gt;");
    expect(html).not.toContain("PRIVATE_UNSELECTED");
    expect(html).toContain("default-src 'none'");
  });
  it("rejects executable image URLs", () => {
    expect(() =>
      evidencePackage(examples()[0], "hello", [
        { ...image, image: "javascript:alert(1)" },
      ]),
    ).toThrow();
  });
});
