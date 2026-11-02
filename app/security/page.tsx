import Link from "next/link";
export default function SecurityPage() {
  return (
    <main className="legal-page" id="main-content">
      <article className="legal-shell">
        <Link className="brand" href="/">
          AsShown
        </Link>
        <h1>Security and evidence</h1>
        <p>
          Source-backed decisions require clear boundaries between product
          claims, generated images, and personal data.
        </p>
        <h2>Private sessions</h2>
        <p>
          Preview sessions use server-checked capability cookies. Image routes
          require the session owner. Uploaded images are decoded, limited,
          normalized, and passed through the configured scanner before live use.
          Production requires the private storage and safety services described
          in the setup guide.
        </p>
        <h2>External actions</h2>
        <p>
          Seller questions and arrival messages are drafts. Nothing is sent,
          purchased, or disputed with a retailer automatically. Retailer imports
          use an explicit host allowlist, public-address checks, pinned DNS,
          response-size limits, and no redirect following.
        </p>
        <h2>Evidence limits</h2>
        <p>
          A signed preview receipt describes recorded inputs and results. It is
          not proof of physical fit or correctness. Unvalidated garment
          observations require manual review. A missing verifier cannot produce
          a passed check.
        </p>
        <h2>Operational readiness</h2>
        <p>
          This hackathon build is not a security or privacy certification.
          Provider retention, backups, production isolation, held-out visual
          evaluation, and incident response must be verified before public beta.
        </p>
        <Link className="as-primary" href="/check?view=privacy">
          Report a concern
        </Link>
      </article>
    </main>
  );
}
