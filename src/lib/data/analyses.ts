import type { AnalysisStatus } from "@/types/database";
import type { Viewer } from "@/lib/supabase/viewer";
import { createClient } from "@/lib/supabase/server";

export type AnalysisSummary = {
  id: string;
  title: string;
  jobTitle: string | null;
  companyName: string | null;
  status: AnalysisStatus;
  candidateCount: number;
  topCandidate: string | null;
  topScore: number | null;
  createdAt: string;
  isSample: boolean;
};

const sampleAnalyses: AnalysisSummary[] = [
  {
    id: "demo",
    title: "Frontend Engineer shortlist",
    jobTitle: "Senior Frontend Engineer",
    companyName: "Northstar Labs",
    status: "COMPLETED",
    candidateCount: 8,
    topCandidate: "Arjun Sharma",
    topScore: 92.4,
    createdAt: "2026-09-12T08:30:00.000Z",
    isSample: true,
  },
  {
    id: "demo-product",
    title: "Product Designer shortlist",
    jobTitle: "Product Designer",
    companyName: "Aperture Systems",
    status: "PROCESSING",
    candidateCount: 8,
    topCandidate: null,
    topScore: null,
    createdAt: "2026-09-11T11:20:00.000Z",
    isSample: true,
  },
  {
    id: "demo-data",
    title: "Data platform shortlist",
    jobTitle: "Data Engineer",
    companyName: "Parcel Works",
    status: "COMPLETED",
    candidateCount: 8,
    topCandidate: "Arjun Sharma",
    topScore: 92.4,
    createdAt: "2026-09-08T06:45:00.000Z",
    isSample: true,
  },
];

export async function getAnalyses(viewer: Viewer): Promise<AnalysisSummary[]> {
  if (viewer.isDemo) {
    return sampleAnalyses;
  }

  const supabase = await createClient();
  const { data: analyses, error } = await supabase
    .from("analyses")
    .select(
      "id,title,job_title,company_name,status,candidate_count,created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("We could not load your shortlists.");
  }

  const analysisIds = analyses.map((analysis) => analysis.id);
  const { data: topCandidates } = analysisIds.length
    ? await supabase
        .from("candidates")
        .select("analysis_id,name,final_score")
        .in("analysis_id", analysisIds)
        .eq("rank", 1)
    : { data: [] };

  return analyses.map((analysis) => {
    const top = topCandidates?.find(
      (candidate) => candidate.analysis_id === analysis.id,
    );
    return {
      id: analysis.id,
      title: analysis.title,
      jobTitle: analysis.job_title,
      companyName: analysis.company_name,
      status: analysis.status,
      candidateCount: analysis.candidate_count,
      topCandidate: top?.name ?? null,
      topScore: top?.final_score ?? null,
      createdAt: analysis.created_at,
      isSample: false,
    };
  });
}
