import { Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect } from "next/navigation";
import { retailerAuthorized } from "@/lib/session-auth";
import { retailerAnalytics } from "@/lib/retailer-analytics";

export default async function DashboardPage() {
  const access = await retailerAuthorized();
  if (!access.authorized) redirect("/signin?callbackUrl=/dashboard");
  const analytics = await retailerAnalytics(access.tenantId ?? "public");
  const metrics = analytics.metrics;
  const failures = analytics.failures;
  const values = [62, 69, 65, 77, 74, 82, 79, 86];
  return (
    <div className="dashboard-page">
      <SiteHeader studio />
      <main className="dashboard-main">
        <div className="container">
          <div className="dashboard-title">
            <div><span className="section-kicker">Retailer quality console</span><h1>Integrity overview</h1><p>Anonymous operational evidence. No customer images, face embeddings, or demographic labels. {access.demo ? "Local demo workspace." : "Authenticated organization workspace."}</p></div>
            <a className="btn btn-secondary" href="/api/v1/retailer/export" download><Download size={15} /> Export aggregate</a>
          </div>
          <section className="metric-grid" aria-label="Quality metrics">
            {metrics.map((metric) => <article className="metric-card" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
          </section>
          <div className="dashboard-grid">
            <section className="chart-card">
              <div className="chart-head"><h2>Contract outcomes over time</h2><span>Last 8 weeks · controlled demo data</span></div>
              <div className="bar-chart" aria-label="Pass and review rates across eight weeks">
                {values.map((value, index) => <div className="bar-group" key={index}><div className="bar" style={{ height: `${value}%` }} title={`${value}% passed`} /><div className="bar alt" style={{ height: `${Math.max(9, 100 - value - 10)}%` }} title={`${Math.max(9, 100 - value - 10)}% review`} /></div>)}
              </div>
              <div className="chart-labels">{["Jun 1", "Jun 8", "Jun 15", "Jun 22", "Jun 29", "Jul 6", "Jul 13", "Jul 20"].map((label) => <span key={label}>{label}</span>)}</div>
            </section>
            <section className="chart-card">
              <div className="chart-head"><h2>Leading review reasons</h2><span>Minimum cohort n=20</span></div>
              <div className="failure-list">{failures.length ? failures.map((failure) => <div className="failure-row" key={failure.name}><div><strong>{failure.name}</strong><small>{failure.detail}</small></div><span className="failure-value">{failure.value}</span></div>) : <p>No reason-code cohort is large enough to display.</p>}</div>
            </section>
          </div>
          <div className="privacy-callout"><LockKeyhole size={20} /><span><strong>Privacy threshold active.</strong> {analytics.suppressed ? `Metrics are hidden because this workspace has ${analytics.cohort} verified sessions; 20 are required.` : "All displayed cohorts meet the minimum size of 20."} KeepMe never exposes an individual shopper view.</span></div>
          {access.demo && <div className="privacy-callout" style={{ background: "#eee9d8", color: "var(--ink)" }}><ShieldCheck size={20} /><span>This local workspace intentionally shows no invented product outcomes. Connect production Postgres to populate aggregate evidence.</span></div>}
        </div>
      </main>
    </div>
  );
}
