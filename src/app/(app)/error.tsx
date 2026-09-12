"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";

export default function RecruiterWorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className="workspace-page failed-analysis-page">
      <section className="failure-state">
        <span className="app-meta-label">WORKSPACE / LOAD ERROR</span>
        <h1>We couldn’t load this workspace.</h1>
        <p>
          Your data has not been changed. Retry the request, or return to your
          shortlists and reopen the analysis.
        </p>
        <div>
          <button className="primary-action" onClick={() => reset()} type="button">
            <RotateCcw size={15} /> Try again
          </button>
          <Link className="secondary-action" href="/dashboard">
            Return to shortlists <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
