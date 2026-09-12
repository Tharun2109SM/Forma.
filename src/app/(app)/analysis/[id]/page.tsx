import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisWorkspace } from "@/components/analysis/analysis-workspace";
import { getAnalysis } from "@/lib/data/analysis";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Analysis" };

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; preview?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) notFound();

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const analysis = await getAnalysis(viewer, id);
  if (!analysis) notFound();

  const previewState = analysis.isSample ? query.state : undefined;
  const initialMode =
    previewState === "failed" || analysis.status === "FAILED"
      ? "failed"
      : previewState === "processing" ||
          analysis.status === "DRAFT" ||
          analysis.status === "PROCESSING" ||
          analysis.status === "UPLOADING"
        ? "processing"
        : "completed";

  return (
    <AnalysisWorkspace
      analysis={analysis}
      initialMode={initialMode}
      resolvePreview={analysis.isSample}
    />
  );
}
