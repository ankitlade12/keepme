import Link from "next/link";
export default function PrivacyPage() {
  return (
    <main className="legal-page" id="main-content">
      <article className="legal-shell">
        <Link className="brand" href="/">
          AsShown
        </Link>
        <h1>Your choices and data</h1>
        <p>
          AsShown helps you compare clothing against requirements. Product-only
          checks do not require a personal photo.
        </p>
        <h2>Browser and saved workspaces</h2>
        <p>
          Guest product text, requirements, notes and reports are stored in this
          browser tab with a 30-minute restoration window. Product images remain
          in memory and are omitted on refresh. Explicit server saves use a
          server-bound guest session or your signed-in account. Guest server
          copies expire after 30 minutes; account metadata remains until
          deleted. Decision exports omit photos. Signed-in users can separately
          save original evidence and processing copies in private storage for 30
          days, renew that period, or delete them. Saved workspaces retain
          private image links.
        </p>
        <h2>Separate processing choices</h2>
        <p>
          Optional previews send approved images to Perfect Corp’s YouCam.
          Optional language and visual assistance sends the selected text or
          images directly to OpenAI. Each action requires its own consent.
          Processing-consent metadata is retained for up to 30 days; it contains
          the purpose and model, not the image or source text. No research reuse
          or personal-photo publication is enabled.
        </p>
        <h2>Community notes</h2>
        <p>
          Public text contributions require separate approval and moderation.
          Moderation does not certify a product claim. You can dispute a report,
          appeal removal, correct, or withdraw your own submission. Optional
          product-only photos require a redaction preview, separate publication
          consent, automated person screening and explicit moderator image
          review. Only the flattened reviewed copy is eligible for publication;
          screening is not a guarantee that all private details were detected.
        </p>
        <h2>Deletion and limitations</h2>
        <p>
          Delete browser data in Privacy, saved server data in Saved checks, and
          preview images in the preview studio. Preview deletion revokes
          application access and queues storage cleanup; failed cleanup stays
          pending. This does not establish deletion from Perfect Corp or another
          processor. Provider retention, backup expiry, and operational log
          policies require verification before public beta.
        </p>
        <h2>Support</h2>
        <p>
          Use the image-free report form in Privacy for incorrect findings,
          accessibility, billing or privacy concerns. Do not include credentials
          or unnecessary personal information.
        </p>
        <Link className="as-primary" href="/check?view=privacy">
          Manage your data
        </Link>
      </article>
    </main>
  );
}
