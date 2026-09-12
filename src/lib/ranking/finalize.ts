import "server-only";

import { embedTexts } from "@/lib/openai/embeddings";
import { rankCandidates } from "@/lib/ranking/rank";
import {
  extractWeightedRequirements,
  matchWeightedRequirements,
} from "@/lib/ranking/requirements";
import { semanticScore } from "@/lib/ranking/semantic";
import { createAdminClient } from "@/lib/supabase/admin";

export async function finalizeAnalysisIfReady(analysisId: string, userId: string) {
  const supabase = createAdminClient();
  const { data: documents, error: documentError } = await supabase
    .from("documents")
    .select("id,candidate_id,document_type,status,extracted_text")
    .eq("analysis_id", analysisId)
    .eq("user_id", userId);
  if (documentError) throw documentError;
  if (!documents?.length) return { finalized: false, reason: "NO_DOCUMENTS" } as const;
  if (documents.some((document) => !["READY", "FAILED"].includes(document.status))) {
    return { finalized: false, reason: "PENDING_DOCUMENTS" } as const;
  }

  const jobDescription = documents.find(
    (document) =>
      document.document_type === "JOB_DESCRIPTION" &&
      document.status === "READY" &&
      document.extracted_text?.trim(),
  );
  const resumes = documents.filter(
    (document) =>
      document.document_type === "RESUME" &&
      document.status === "READY" &&
      document.candidate_id &&
      document.extracted_text?.trim(),
  );
  if (!jobDescription || resumes.length === 0) {
    await supabase
      .from("analyses")
      .update({ status: "FAILED" })
      .eq("id", analysisId)
      .eq("user_id", userId);
    return { finalized: true, reason: "NO_RANKABLE_DOCUMENTS" } as const;
  }

  const texts = [
    jobDescription.extracted_text!,
    ...resumes.map((resume) => resume.extracted_text!),
  ];
  const embeddings = await embedTexts(texts);
  const requirements = extractWeightedRequirements(jobDescription.extracted_text!);
  const ranked = rankCandidates(
    resumes.map((resume, index) => {
      const explicit = matchWeightedRequirements(resume.extracted_text!, requirements);
      return {
        id: resume.candidate_id!,
        semanticScore: semanticScore(embeddings[0]!, embeddings[index + 1]!),
        keywordScore: explicit.keywordScore,
        skillScore: explicit.requiredScore,
        matchedSkills: explicit.matched,
        missingSkills: explicit.missingRequired,
      };
    }),
  );

  for (const candidate of ranked) {
    const { error } = await supabase
      .from("candidates")
      .update({
        semantic_score: candidate.semanticScore,
        keyword_score: candidate.keywordScore,
        skill_score: candidate.skillScore,
        final_score: candidate.finalScore,
        rank: candidate.rank,
        matched_skills: candidate.matchedSkills,
        missing_skills: candidate.missingSkills,
      })
      .eq("id", candidate.id)
      .eq("analysis_id", analysisId);
    if (error) throw error;
  }

  const { error: analysisError } = await supabase
    .from("analyses")
    .update({ status: "COMPLETED" })
    .eq("id", analysisId)
    .eq("user_id", userId);
  if (analysisError) throw analysisError;
  return { finalized: true, ranked: ranked.length } as const;
}
