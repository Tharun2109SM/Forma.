import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import { deriveCandidateEvidence, type EvidenceChunk } from "./derive";
import { selectionBelongsToAnalysis } from "./selection";

export class EvidenceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
// Uses the request's authenticated client, never service_role. RLS stays active.
export async function loadEvidenceContext(
  supabase: SupabaseClient<Database>,
  analysisId: string,
  ids: string[],
) {
  if (
    !z.uuid().safeParse(analysisId).success ||
    !z.array(z.uuid()).min(1).max(4).safeParse(ids).success ||
    new Set(ids).size !== ids.length
  )
    throw new EvidenceError("Invalid evidence selection.", 400);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    throw new EvidenceError("Sign in to inspect evidence.", 401);
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("id,title,job_title,status,jd_text,candidate_count")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (analysisError)
    throw new EvidenceError("Analysis could not be loaded.", 502);
  if (!analysis) throw new EvidenceError("Analysis not found.", 404);
  const { data: candidates, error } = await supabase
    .from("candidates")
    .select(
      "id,analysis_id,name,resume_filename,resume_text,rank,final_score,semantic_score,keyword_score,skill_score,matched_skills,missing_skills",
    )
    .eq("analysis_id", analysisId)
    .in("id", ids);
  if (error)
    throw new EvidenceError("Candidate records could not be loaded.", 502);
  if (!selectionBelongsToAnalysis(ids, candidates ?? [], analysisId))
    throw new EvidenceError(
      "One or more candidates are no longer available in this analysis.",
      404,
    );
  return {
    analysis,
    candidates: ids.map((id) => candidates!.find((c) => c.id === id)!),
  };
}
export async function loadCandidateEvidenceBatch(
  supabase: SupabaseClient<Database>,
  analysisId: string,
  ids: string[],
) {
  const { analysis, candidates } = await loadEvidenceContext(
    supabase,
    analysisId,
    ids,
  );
  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select(
      "id,analysis_id,candidate_id,document_type,filename,extracted_text,status",
    )
    .eq("analysis_id", analysisId)
    .in("candidate_id", ids)
    .eq("document_type", "RESUME");
  if (docError)
    throw new EvidenceError("Source documents could not be loaded.", 502);
  const chunks: EvidenceChunk[] = [];
  // Explicit pagination avoids Supabase's row cap silently dropping evidence.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("document_chunks")
      .select(
        "id,analysis_id,candidate_id,document_id,document_type,content,page_number,section_label,chunk_index",
      )
      .eq("analysis_id", analysisId)
      .in("candidate_id", ids)
      .eq("document_type", "RESUME")
      .order("id")
      .range(offset, offset + 999);
    if (error)
      throw new EvidenceError("Source evidence could not be retrieved.", 502);
    chunks.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return {
    analysis,
    candidates: candidates.map((c) =>
      deriveCandidateEvidence(
        c,
        analysis.jd_text ?? "",
        documents ?? [],
        chunks,
      ),
    ),
  };
}
