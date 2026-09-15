import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppOverview } from "@/lib/data/app-library";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Overview" };

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AppOverviewPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const overview = await getAppOverview(viewer);
  const firstName = viewer.fullName.split(/\s+/)[0] || "there";

  return (
    <main className="saas-page saas-overview-page">
      <header className="saas-page-head">
        <div>
          <span className="saas-eyebrow">WORKSPACE / OVERVIEW</span>
          <h1>Good to see you, {firstName}.</h1>
          <p>One place to track your analyses, processing, and indexed evidence.</p>
        </div>
        <Link className="primary-action" href="/app/analyses/new">New analysis</Link>
      </header>

      {overview.isSample && (
        <p className="saas-inline-note" role="note">Sample workspace · These analyses are illustrative and no documents are stored.</p>
      )}

      <section className="saas-metrics" aria-label="Workspace activity">
        <div className="saas-metric"><span>ANALYSES</span><strong>{overview.totalAnalyses}</strong><small>Available in this workspace</small></div>
        <div className="saas-metric"><span>ACTIVE</span><strong>{overview.activeAnalyses}</strong><small>Uploading or processing</small></div>
        <div className="saas-metric"><span>INDEXED DOCUMENTS</span><strong>{overview.indexedDocuments}</strong><small>Ready for evidence retrieval</small></div>
      </section>

      <section className="saas-section" aria-labelledby="recent-analyses-title">
        <div className="saas-section-head">
          <div><span className="saas-eyebrow">RECENT ACTIVITY</span><h2 id="recent-analyses-title">Recent analyses</h2></div>
          <Link className="saas-link" href="/app/analyses">View all analyses</Link>
        </div>
        {overview.recent.length ? (
          <div className="saas-table-wrap"><table className="saas-table"><thead><tr><th>Analysis</th><th>Company</th><th>Status</th><th>Candidates</th><th>Created</th></tr></thead><tbody>
            {overview.recent.map((item) => <tr key={item.id}>
              <td><Link href={`/app/analyses/${item.id}`}>{item.title}</Link><small>{item.jobTitle ?? "Role not specified"}</small></td>
              <td>{item.companyName ?? "—"}</td><td><span className="saas-status">{item.status.toLowerCase()}</span></td>
              <td>{item.candidateCount}</td><td>{dateFormat.format(new Date(item.createdAt))}</td>
            </tr>)}
          </tbody></table></div>
        ) : (
          <div className="saas-empty"><span className="saas-eyebrow">FIRST ANALYSIS</span><h3>Make your first shortlist.</h3><p>Add one role description and the candidate documents you want to compare.</p><Link className="primary-action" href="/app/analyses/new">Create analysis</Link></div>
        )}
      </section>
    </main>
  );
}
