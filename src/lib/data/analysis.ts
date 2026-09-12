import type { AnalysisStatus } from "@/types/database";
import type { Viewer } from "@/lib/supabase/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  demoCandidates,
  type CandidateResult,
} from "@/lib/data/demo-candidates";

export type AnalysisWorkspaceData = {
  id: string;
  title: string;
  jobTitle: string | null;
  companyName: string | null;
  candidateCount: number;
  status: AnalysisStatus;
  createdAt: string;
  candidates: CandidateResult[];
  isSample: boolean;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function getAnalysis(
  viewer: Viewer,
  id: string,
): Promise<AnalysisWorkspaceData | null> {
  if (viewer.isDemo || id.startsWith("demo")) {
    return {
      id,
      title:
        id === "demo-product"
          ? "Product Designer shortlist"
          : id === "demo-data"
            ? "Data platform shortlist"
            : "Frontend Engineer shortlist",
      jobTitle:
        id === "demo-product"
          ? "Product Designer"
          : id === "demo-data"
            ? "Data Engineer"
            : "Senior Frontend Engineer",
      companyName:
        id === "demo-product"
          ? "Aperture Systems"
          : id === "demo-data"
            ? "Parcel Works"
            : "Northstar Labs",
      candidateCount: demoCandidates.length,
      status: id === "demo-product" ? "PROCESSING" : "COMPLETED",
      createdAt: "2026-09-12T08:30:00.000Z",
      candidates: demoCandidates,
      isSample: true,
    };
  }

  const supabase = await createClient();
  const { data: analysis, error } = await supabase
    .from("analyses")
    .select(
      "id,title,job_title,company_name,candidate_count,status,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !analysis) return null;

  const { data: candidates } = await supabase
    .from("candidates")
    .select(
      "id,name,email,resume_filename,semantic_score,keyword_score,skill_score,final_score,rank,matched_skills,missing_skills,explanation",
    )
    .eq("analysis_id", id)
    .order("rank", { ascending: true, nullsFirst: false });

  return {
    id: analysis.id,
    title: analysis.title,
    jobTitle: analysis.job_title,
    companyName: analysis.company_name,
    candidateCount: analysis.candidate_count,
    status: analysis.status,
    createdAt: analysis.created_at,
    candidates: (candidates ?? []).map((candidate, index) => ({
      id: candidate.id,
      rank: candidate.rank ?? index + 1,
      name: candidate.name ?? candidate.resume_filename.replace(/\.pdf$/i, ""),
      email: candidate.email,
      resumeFilename: candidate.resume_filename,
      semanticScore: candidate.semantic_score ?? 0,
      keywordScore: candidate.keyword_score ?? 0,
      skillScore: candidate.skill_score ?? 0,
      finalScore: candidate.final_score ?? 0,
      matchedSkills: stringArray(candidate.matched_skills),
      missingSkills: stringArray(candidate.missing_skills),
      explanation: candidate.explanation,
      evidence: [],
    })),
    isSample: false,
  };
}
