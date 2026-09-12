"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="workspace-page dashboard-page">
      <section className="empty-state error-state">
        <span className="app-meta-label">LOAD ERROR</span>
        <h2>Your shortlists are temporarily unavailable.</h2>
        <p>No data was changed. Try loading the workspace again.</p>
        <button className="primary-action" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
