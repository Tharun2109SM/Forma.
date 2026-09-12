import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AnalysisNotFound() {
  return (
    <main className="workspace-page failed-analysis-page">
      <section className="failure-state">
        <span className="app-meta-label">ANALYSIS / NOT FOUND</span>
        <h1>This shortlist is unavailable.</h1>
        <p>It may have been removed, or it belongs to a different account.</p>
        <Link className="primary-action" href="/dashboard">
          <ArrowLeft size={15} /> Return to shortlists
        </Link>
      </section>
    </main>
  );
}
