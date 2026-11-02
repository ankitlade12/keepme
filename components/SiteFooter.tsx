import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" href="/" prefetch={false}><span className="brand-mark" aria-hidden="true" />AsShown</Link>
          </div>
          <div className="footer-col"><h4>Product</h4><Link href="/studio" prefetch={false}>Safe try-on</Link><Link href="/check?view=shortlist" prefetch={false}>Your shortlist</Link><a href="#how-it-works">How it works</a></div>
          <div className="footer-col"><h4>Trust</h4><Link href="/privacy" prefetch={false}>Privacy</Link><Link href="/terms" prefetch={false}>Terms</Link><Link href="/security" prefetch={false}>Security</Link></div>
        </div>
        <div className="footer-bottom"><span>© 2026 AsShown.</span><span>Visual consistency—not identity verification or a fit guarantee.</span></div>
      </div>
    </footer>
  );
}
