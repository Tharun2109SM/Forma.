export default function AnalysisLoading() {
  return (
    <main className="workspace-page" aria-busy="true" aria-label="Loading analysis">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton-list">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    </main>
  );
}
