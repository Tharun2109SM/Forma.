import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  EvidenceError,
  loadCandidateEvidenceBatch,
} from "@/lib/evidence/service";
import { validateCandidateSelection } from "@/lib/evidence/selection";
import { ComparisonWorkspace } from "@/components/analysis/comparison-workspace";

export const metadata = { title: "Compare candidates" };
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidates?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let result: Awaited<ReturnType<typeof loadCandidateEvidenceBatch>> | null =
    null;
  let message = "";
  try {
    const ids = validateCandidateSelection(
      typeof query.candidates === "string" ? query.candidates.split(",") : [],
    );
    result = await loadCandidateEvidenceBatch(await createClient(), id, ids);
  } catch (error) {
    if (error instanceof EvidenceError && error.status === 401)
      redirect("/login");
    message =
      error instanceof EvidenceError
        ? error.message
        : "Select 2–4 distinct candidates from the same analysis.";
  }
  if (!result)
    return (
      <main className="workspace-page">
        <h1>Comparison unavailable.</h1>
        <p>{message}</p>
        <Link href={`/app/analyses/${encodeURIComponent(id)}`}>
          Back to ranking
        </Link>
      </main>
    );
  if (result.analysis.status !== "COMPLETED")
    return (
      <main className="workspace-page">
        <h1>Comparison opens after processing.</h1>
        <p>Stored ranking data is not ready yet.</p>
        <Link href={`/app/analyses/${encodeURIComponent(id)}`}>
          Back to analysis
        </Link>
      </main>
    );
  return (
    <ComparisonWorkspace
      analysisId={id}
      title={result.analysis.job_title ?? result.analysis.title}
      candidates={result.candidates}
      totalCandidates={result.analysis.candidate_count}
    />
  );
}
