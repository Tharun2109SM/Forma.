import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppAnalyses, type AnalysisFilters } from "@/lib/data/app-library";
import { firstParam, pageHref, pageParam, type AppSearchParams } from "@/lib/data/app-route-params";
import { getViewer } from "@/lib/supabase/viewer";
import type { AnalysisStatus } from "@/types/database";

export const metadata: Metadata = { title: "Analyses" };

const statuses: AnalysisStatus[] = ["DRAFT", "UPLOADING", "PROCESSING", "COMPLETED", "FAILED"];
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

export default async function AnalysesPage({ searchParams }: { searchParams: AppSearchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const params = await searchParams;
  const search = firstParam(params.search);
  const rawStatus = firstParam(params.status).toUpperCase();
  const status = statuses.includes(rawStatus as AnalysisStatus) ? rawStatus as AnalysisStatus : "ALL";
  const rawSort = firstParam(params.sort);
  const sort: NonNullable<AnalysisFilters["sort"]> =
    rawSort === "oldest" || rawSort === "updated" ? rawSort : "newest";
  const rawPeriod = firstParam(params.period);
  const period: NonNullable<AnalysisFilters["period"]> =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "90d" ? rawPeriod : "all";
  const page = pageParam(params.page);
  const result = await getAppAnalyses(viewer, { search, status, period, sort, page });
  const query = { search, status, period, sort };
  const pageCount = Math.ceil(result.total / result.pageSize);

  return <main className="saas-page saas-analyses-page">
    <header className="saas-page-head"><div><span className="saas-eyebrow">LIBRARY / ANALYSES</span><h1>Analyses</h1><p>Every role, shortlist, and ranking in one searchable record.</p></div><Link className="primary-action" href="/app/analyses/new">New analysis</Link></header>
    {result.isSample && <p className="saas-inline-note" role="note">Sample analyses · Preview data is not persisted.</p>}
    <form className="saas-toolbar" action="/app/analyses" method="get" role="search">
      <label><span>Search</span><input className="saas-filter-input" name="search" defaultValue={search} placeholder="Role, company, or analysis" /></label>
      <label><span>Status</span><select className="saas-filter-select" name="status" defaultValue={status}><option value="ALL">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label>
      <label><span>Created</span><select className="saas-filter-select" name="period" defaultValue={period}><option value="all">Any time</option><option value="7d">Past 7 days</option><option value="30d">Past 30 days</option><option value="90d">Past 90 days</option></select></label>
      <label><span>Order</span><select className="saas-filter-select" name="sort" defaultValue={sort}><option value="newest">Newest</option><option value="updated">Recently updated</option><option value="oldest">Oldest</option></select></label>
      <button className="secondary-action" type="submit">Apply</button>
    </form>
    {result.items.length ? <section className="saas-section" aria-label="Analysis library"><div className="saas-table-wrap"><table className="saas-table"><thead><tr><th>Role / analysis</th><th>Company</th><th>Status</th><th>Candidates</th><th>Top result</th><th>Created</th><th>Updated</th></tr></thead><tbody>
      {result.items.map((item) => <tr key={item.id}><td><Link href={`/app/analyses/${item.id}`}>{item.title}</Link><small>{item.jobTitle ?? "Role not specified"}</small></td><td>{item.companyName ?? "—"}</td><td><span className="saas-status">{item.status.toLowerCase()}</span></td><td>{item.candidateCount}</td><td>{item.topCandidate ?? "—"}{item.topScore !== null && <small>{item.topScore.toFixed(1)} score</small>}</td><td>{dateFormat.format(new Date(item.createdAt))}</td><td>{dateFormat.format(new Date(item.updatedAt))}</td></tr>)}
    </tbody></table></div></section> : <section className="saas-empty"><span className="saas-eyebrow">NO MATCHES</span><h2>{search || status !== "ALL" || period !== "all" ? "No analyses match those filters." : "Your analysis library starts here."}</h2><p>{search || status !== "ALL" || period !== "all" ? "Try another role, company, status, or date range." : "Create an analysis from a job description and candidate documents."}</p><Link className="primary-action" href="/app/analyses/new">New analysis</Link></section>}
    {pageCount > 1 && <nav className="saas-pagination" aria-label="Analysis pages"><span>{result.total} analyses · page {result.page} of {pageCount}</span><div>{result.page > 1 && <Link href={pageHref("/app/analyses", query, result.page - 1)}>Previous</Link>}{result.page < pageCount && <Link href={pageHref("/app/analyses", query, result.page + 1)}>Next</Link>}</div></nav>}
  </main>;
}
