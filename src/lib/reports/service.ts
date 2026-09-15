import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import { loadCandidateEvidenceBatch } from "@/lib/evidence/service";
import { DEFAULT_WEIGHTS } from "@/lib/ranking/score";
import { extractWeightedRequirements } from "@/lib/ranking/requirements";
import { ReportError } from "./selection";
import type { FormaReport, ReportCandidate, ReportSelection } from "./types";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
}

// Only an authenticated, request-scoped Supabase client. No privileged fallback.
export async function loadFormaReport(supabase: SupabaseClient<Database>, analysisId: string, selection: ReportSelection): Promise<FormaReport> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new ReportError("Sign in to download reports.", 401);
  if (!z.uuid().safeParse(analysisId).success) throw new ReportError("Analysis not found.", 404);
  const { data: analysis, error } = await supabase.from("analyses")
    .select("id,title,job_title,company_name,jd_filename,jd_text,status,updated_at")
    .eq("id", analysisId).eq("user_id", user.id).maybeSingle();
  if (error) throw new ReportError("The analysis could not be loaded. Try again.", 502);
  if (!analysis) throw new ReportError("Analysis not found.", 404);
  if (analysis.status !== "COMPLETED") throw new ReportError("Reports are available once the analysis is completed.", 409);

  const all: ReportCandidate[] = [];
  // Fetch the entire persisted ranking, independent of UI filters and API row caps.
  for (let offset = 0; ; offset += 500) {
    const { data, error: candidateError } = await supabase.from("candidates")
      .select("id,analysis_id,name,resume_filename,rank,final_score,semantic_score,keyword_score,skill_score,matched_skills,missing_skills,explanation")
      .eq("analysis_id", analysisId).order("rank", { ascending: true, nullsFirst: false }).order("id")
      .range(offset, offset + 499);
    if (candidateError) throw new ReportError("The ranking could not be loaded. Try again.", 502);
    if (data?.some((c) => c.analysis_id !== analysisId)) throw new ReportError("Candidate selection is unavailable.", 404);
    all.push(...(data ?? []).map((c) => ({
      id: c.id, name: c.name ?? c.resume_filename.replace(/\.[^.]+$/i, ""), filename: c.resume_filename,
      rank: c.rank, finalScore: c.final_score, semanticScore: c.semantic_score,
      explicitScore: c.keyword_score, coverageScore: c.skill_score,
      evidenced: strings(c.matched_skills), notEvidenced: strings(c.missing_skills), explanation: c.explanation,
    })));
    if ((data?.length ?? 0) < 500) break;
  }
  if (!all.length) throw new ReportError("No candidate ranking is available for this analysis.", 409);
  if (selection.candidateIds.some((id) => !all.some((c) => c.id === id)))
    throw new ReportError("One or more candidates are unavailable in this analysis.", 404);
  const candidates = selection.type === "candidate" || selection.type === "comparison"
    ? all.filter((c) => selection.candidateIds.includes(c.id))
    : selection.type === "top-candidates" ? all.slice(0, 3) : all;
  if (selection.type !== "ranking") {
    const detailed = selection.type === "shortlist" ? candidates.slice(0, 3) : candidates;
    // Reuse the same authenticated timeline infrastructure as the candidate UI.
    const evidence = await loadCandidateEvidenceBatch(supabase, analysisId, detailed.map((c) => c.id));
    for (const c of detailed) c.evidence = evidence.candidates.find((e) => e.candidate.id === c.id);
  }
  // Do not emit a mixed snapshot if the analysis was restarted during retrieval.
  const { data: latest, error: latestError } = await supabase.from("analyses")
    .select("status,updated_at").eq("id", analysisId).eq("user_id", user.id).maybeSingle();
  if (latestError) throw new ReportError("Report data could not be verified. Try again.", 502);
  if (!latest || latest.status !== "COMPLETED" || latest.updated_at !== analysis.updated_at)
    throw new ReportError("The analysis changed while preparing the report. Try again.", 409);
  return {
    type: selection.type, analysis: { id: analysis.id, title: analysis.title, jobTitle: analysis.job_title, company: analysis.company_name, jdFilename: analysis.jd_filename },
    generatedAt: new Date().toISOString(), totalCandidates: all.length, candidates,
    weights: { ...DEFAULT_WEIGHTS }, requirements: extractWeightedRequirements(analysis.jd_text ?? ""),
  };
}
