export default function DashboardLoading() {
  return (
    <main className="workspace-page dashboard-page" aria-label="Loading shortlists">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton-list">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="skeleton skeleton-row" key={index} />
        ))}
      </div>
    </main>
  );
}
