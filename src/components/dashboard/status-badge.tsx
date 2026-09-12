import type { AnalysisStatus } from "@/types/database";

const labels: Record<AnalysisStatus, string> = {
  DRAFT: "Draft",
  UPLOADING: "Uploading",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function StatusBadge({ status }: { status: AnalysisStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <i aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
