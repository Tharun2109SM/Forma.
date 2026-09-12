import Link from "next/link";
import { ArrowRight, FilePlus2, Plus } from "lucide-react";
import type { AnalysisSummary } from "@/lib/data/analyses";
import { StatusBadge } from "@/components/dashboard/status-badge";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function DashboardView({ analyses }: { analyses: AnalysisSummary[] }) {
  return (
    <main className="workspace-page dashboard-page">
      <header className="page-heading-row">
        <div>
          <span className="page-kicker">SHORTLISTS / ALL</span>
          <h1>Candidate shortlists</h1>
          <p>Review previous analyses or begin with a new role.</p>
        </div>
        <Link className="primary-action" href="/analysis/new">
          <Plus size={16} strokeWidth={1.8} /> New analysis
        </Link>
      </header>

      {analyses.length === 0 ? (
        <section className="empty-state">
          <div className="empty-mark" aria-hidden="true">
            <FilePlus2 size={22} strokeWidth={1.5} />
          </div>
          <span className="app-meta-label">NO ANALYSES YET</span>
          <h2>Your first shortlist starts with one role.</h2>
          <p>Add a job description and the resumes you want to compare.</p>
          <Link className="primary-action" href="/analysis/new">
            Create analysis <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <section className="analysis-list" aria-label="Saved analyses">
          <div className="analysis-list-header" aria-hidden="true">
            <span>Analysis</span>
            <span>Status</span>
            <span>Candidates</span>
            <span>Top match</span>
            <span>Created</span>
            <span />
          </div>
          {analyses.map((analysis) => {
            const state = analysis.status === "PROCESSING" ? "?state=processing" : "";
            return (
              <Link
                className="analysis-list-row"
                href={`/analysis/${analysis.id}${state}`}
                key={analysis.id}
              >
                <span className="analysis-title-cell">
                  <strong>{analysis.title}</strong>
                  <small>
                    {[analysis.jobTitle, analysis.companyName]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <StatusBadge status={analysis.status} />
                <span className="mono-cell">{analysis.candidateCount}</span>
                <span className="top-match-cell">
                  {analysis.topCandidate ? (
                    <>
                      <strong>{analysis.topScore?.toFixed(1)}</strong>
                      <small>{analysis.topCandidate}</small>
                    </>
                  ) : (
                    <small>Pending</small>
                  )}
                </span>
                <span className="date-cell">
                  {dateFormatter.format(new Date(analysis.createdAt))}
                </span>
                <ArrowRight className="row-arrow" size={16} strokeWidth={1.7} />
              </Link>
            );
          })}
          {analyses.some((analysis) => analysis.isSample) && (
            <p className="sample-disclosure">
              Sample data demonstrates the interface only. Scores are not the output of a live analysis.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
