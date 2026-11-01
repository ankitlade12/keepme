import Link from "next/link";
export default function TermsPage() {
  return (
    <main className="legal-page" id="main-content">
      <article className="legal-shell">
        <Link className="brand" href="/">
          AsShown
        </Link>
        <h1>Prototype terms</h1>
        <p>
          AsShown is an adult clothing-shopping research prototype. Use only
          source images, listing excerpts, and personal photos you have
          permission to process.
        </p>
        <h2>Your decisions</h2>
        <p>
          Seller statements, contributor reports, and model observations can be
          incomplete or wrong. Generated previews do not establish fit, comfort,
          material authenticity, safety, opacity, or functional construction.
          You decide what to investigate or purchase.
        </p>
        <h2>Contributions</h2>
        <p>
          Submit only product-related statements with accurate variant context.
          Do not publish personal information, personal photos, or unsupported
          accusations. Moderators may decline or remove contributions;
          contributors can appeal or withdraw their own reports.
        </p>
        <h2>Availability and costs</h2>
        <p>
          Generation and optional language assistance depend on configured
          providers and bounded project allowances. No paid subscription or
          purchase flow is enabled. A provider may charge a submitted generation
          even if local polling is stopped.
        </p>
        <h2>Before a broader launch</h2>
        <p>
          These notices describe the prototype. Formal commercial terms and
          jurisdiction-specific obligations require review before public beta.
        </p>
        <Link className="as-primary" href="/check">
          Return to your workspace
        </Link>
      </article>
    </main>
  );
}
