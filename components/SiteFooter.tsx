import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true" />KeepMe</Link>
            <p className="footer-copy">A consent and integrity layer for generative virtual try-on. Built so people—not models—decide what must stay unchanged.</p>
          </div>
          <div className="footer-col"><h4>Product</h4><Link href="/studio">Safe try-on</Link><Link href="/dashboard">Retailer insights</Link><a href="#how-it-works">How it works</a></div>
          <div className="footer-col"><h4>Trust</h4><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/security">Security</Link></div>
        </div>
        <div className="footer-bottom"><span>© 2026 KeepMe.</span><span>Visual consistency—not identity verification or a fit guarantee.</span></div>
      </div>
    </footer>
  );
}
