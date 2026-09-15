import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppDocuments } from "@/lib/data/app-library";
import { firstParam, pageHref, pageParam, type AppSearchParams } from "@/lib/data/app-route-params";
import { getViewer } from "@/lib/supabase/viewer";
import type { DocumentStatus, DocumentType } from "@/types/database";

export const metadata: Metadata = { title: "Documents" };

const statuses: DocumentStatus[] = ["QUEUED", "UPLOADING", "UPLOADED", "EXTRACTING", "OCR", "NORMALIZING", "INDEXING", "READY", "FAILED"];
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function DocumentsPage({ searchParams }: { searchParams: AppSearchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const params = await searchParams;
  const search = firstParam(params.search);
  const rawType = firstParam(params.type).toUpperCase();
  const type: DocumentType | "ALL" = rawType === "RESUME" || rawType === "JOB_DESCRIPTION" ? rawType : "ALL";
  const rawStatus = firstParam(params.status).toUpperCase();
  const status: DocumentStatus | "ALL" = statuses.includes(rawStatus as DocumentStatus) ? rawStatus as DocumentStatus : "ALL";
  const page = pageParam(params.page);
  const result = await getAppDocuments(viewer, { search, type, status, page });
  const query = { search, type, status };
  const pageCount = Math.ceil(result.total / result.pageSize);

  return <main className="saas-page saas-documents-page">
    <header className="saas-page-head"><div><span className="saas-eyebrow">LIBRARY / DOCUMENTS</span><h1>Documents</h1><p>Upload, extraction, and indexing state across your analyses.</p></div><Link className="primary-action" href="/app/analyses/new">New analysis</Link></header>
    {result.isSample && <p className="saas-inline-note" role="note">Sample workspace · No documents are persisted or indexed in preview mode.</p>}
    <form className="saas-toolbar" action="/app/documents" method="get" role="search">
      <label><span>Filename</span><input className="saas-filter-input" name="search" defaultValue={search} placeholder="Search documents" /></label>
      <label><span>Type</span><select className="saas-filter-select" name="type" defaultValue={type}><option value="ALL">All types</option><option value="JOB_DESCRIPTION">Job description</option><option value="RESUME">Resume</option></select></label>
      <label><span>Status</span><select className="saas-filter-select" name="status" defaultValue={status}><option value="ALL">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label>
      <button className="secondary-action" type="submit">Apply</button>
    </form>
    {result.items.length ? <section className="saas-section" aria-label="Document library"><div className="saas-table-wrap"><table className="saas-table"><thead><tr><th>Filename</th><th>Type</th><th>Analysis</th><th>Status</th><th>Extraction</th><th>Indexed</th><th>Created</th></tr></thead><tbody>
      {result.items.map((item) => <tr key={item.id}><td><Link href={`/app/analyses/${item.analysisId}`}>{item.filename}</Link><small>{item.fileExtension.toUpperCase()} · {(item.fileSize / 1024 / 1024).toFixed(1)} MB</small></td><td>{item.documentType === "RESUME" ? "Resume" : "Job description"}</td><td><Link href={`/app/analyses/${item.analysisId}`}>{item.analysisTitle}</Link></td><td><span className="saas-status">{item.status.toLowerCase()}</span></td><td>{item.extractionMethod === "OCR" ? "OCR" : item.extractionMethod === "NATIVE" ? "Native" : "—"}</td><td>{item.indexed ? "Ready" : "—"}</td><td>{dateFormat.format(new Date(item.createdAt))}</td></tr>)}
    </tbody></table></div></section> : <section className="saas-empty"><span className="saas-eyebrow">NO DOCUMENTS</span><h2>{search || type !== "ALL" || status !== "ALL" ? "No documents match those filters." : "Your document index is empty."}</h2><p>{search || type !== "ALL" || status !== "ALL" ? "Try another filename, type, or status." : "Documents are created when you start an analysis."}</p><Link className="primary-action" href="/app/analyses/new">New analysis</Link></section>}
    {pageCount > 1 && <nav className="saas-pagination" aria-label="Document pages"><span>{result.total} documents · page {result.page} of {pageCount}</span><div>{result.page > 1 && <Link href={pageHref("/app/documents", query, result.page - 1)}>Previous</Link>}{result.page < pageCount && <Link href={pageHref("/app/documents", query, result.page + 1)}>Next</Link>}</div></nav>}
  </main>;
}
