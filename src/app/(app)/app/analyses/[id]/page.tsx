import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AnalysisWorkspace } from "@/components/analysis/analysis-workspace";
import { getAnalysis } from "@/lib/data/analysis";
import { firstParam, type AppSearchParams } from "@/lib/data/app-route-params";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Analysis" };

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AppSearchParams;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const analysis = await getAnalysis(viewer, id);
  if (!analysis) notFound();
  const previewState = analysis.isSample ? firstParam(query.state) : "";
  const initialMode =
    previewState === "failed" || analysis.status === "FAILED"
      ? "failed"
      : previewState === "processing" ||
          ["DRAFT", "UPLOADING", "PROCESSING"].includes(analysis.status)
        ? "processing"
        : "completed";
  return (
    <AnalysisWorkspace
      analysis={analysis}
      initialMode={initialMode}
      resolvePreview={analysis.isSample}
      initialCandidateId={firstParam(query.candidate)}
    />
  );
}
