import { NextResponse } from "next/server";
import { z } from "zod";
import { embedText } from "@/lib/openai/embeddings";
import { answerRecruiterQuestion, type RagEvidence } from "@/lib/rag/answer";
import { createClient } from "@/lib/supabase/server";
import {
  EvidenceError,
  loadCandidateEvidenceBatch,
} from "@/lib/evidence/service";
import { validateCandidateSelection } from "@/lib/evidence/selection";
import { scopeComparisonSources } from "@/lib/rag/scope";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  question: z.string().trim().min(3).max(1_000),
  candidateIds: z.array(z.uuid()).min(2).max(4).optional(),
});

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function diversify<T extends { document_id: string; document_type: string }>(
  rows: T[],
) {
  const counts = new Map<string, number>();
  const selected: T[] = [];
  const jd = rows.find((row) => row.document_type === "JOB_DESCRIPTION");
  if (jd) {
    selected.push(jd);
    counts.set(jd.document_id, 1);
  }
  for (const row of rows) {
    if (selected.includes(row)) continue;
    const count = counts.get(row.document_id) ?? 0;
    if (count >= 2) continue;
    selected.push(row);
    counts.set(row.document_id, count + 1);
    if (selected.length >= 16) break;
  }
  return selected;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const analysisId = z.uuid().safeParse((await params).analysisId);
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!analysisId.success || !body.success) {
    return NextResponse.json(
      { error: "Enter a valid analysis question." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: "Sign in to ask about this analysis." },
      { status: 401 },
    );
  }

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id,status")
    .eq("id", analysisId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis)
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  if (analysis.status !== "COMPLETED") {
    return NextResponse.json(
      {
        error: "Forma. is still indexing these documents.",
        code: "ANALYSIS_NOT_READY",
      },
      { status: 409 },
    );
  }

  let comparison: Awaited<
    ReturnType<typeof loadCandidateEvidenceBatch>
  > | null = null;
  if (body.data.candidateIds) {
    try {
      comparison = await loadCandidateEvidenceBatch(
        supabase,
        analysisId.data,
        validateCandidateSelection(body.data.candidateIds),
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof EvidenceError
              ? error.message
              : "Select 2–4 distinct candidates from this analysis.",
        },
        { status: error instanceof EvidenceError ? error.status : 400 },
      );
    }
  }

  const { count: indexedChunkCount, error: countError } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("analysis_id", analysisId.data);
  if (countError) {
    return NextResponse.json(
      {
        error: "Indexed evidence could not be checked.",
        code: "RETRIEVAL_ERROR",
      },
      { status: 502 },
    );
  }
  if (!indexedChunkCount) {
    return NextResponse.json(
      {
        error: "No indexed document evidence is available yet.",
        code: "NO_INDEXED_CHUNKS",
      },
      { status: 409 },
    );
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(body.data.question);
  } catch (error) {
    const rateLimited = errorStatus(error) === 429;
    return NextResponse.json(
      {
        error: rateLimited
          ? "Forma. is receiving too many questions. Try again shortly."
          : "The AI service is temporarily unavailable.",
        code: rateLimited ? "RATE_LIMITED" : "OPENAI_ERROR",
      },
      { status: rateLimited ? 429 : 502 },
    );
  }

  const { data: thresholdMatches, error: matchError } = await supabase.rpc(
    "match_document_chunks",
    {
      p_analysis_id: analysisId.data,
      p_query_embedding: queryEmbedding,
      p_match_count: 36,
      p_similarity_threshold: 0.2,
    },
  );
  if (matchError) {
    return NextResponse.json(
      {
        error: "Document evidence could not be retrieved.",
        code: "RETRIEVAL_ERROR",
      },
      { status: 502 },
    );
  }

  let matches = thresholdMatches ?? [];
  if (matches.length === 0) {
    const { data: fallbackMatches, error: fallbackError } = await supabase.rpc(
      "match_document_chunks",
      {
        p_analysis_id: analysisId.data,
        p_query_embedding: queryEmbedding,
        p_match_count: 16,
        p_similarity_threshold: -1,
      },
    );
    if (fallbackError) {
      return NextResponse.json(
        {
          error: "Document evidence could not be retrieved.",
          code: "RETRIEVAL_ERROR",
        },
        { status: 502 },
      );
    }
    matches = fallbackMatches ?? [];
  }

  const selectedIds = new Set(body.data.candidateIds ?? []);
  const selected = diversify(
    scopeComparisonSources(matches, body.data.candidateIds),
  );
  if (
    selected.length === 0 &&
    !comparison?.candidates.some((c) => c.strongestEvidence.length)
  ) {
    return NextResponse.json(
      {
        error: "No sufficiently relevant document evidence was found.",
        code: "NO_RELEVANT_EVIDENCE",
      },
      { status: 422 },
    );
  }

  const { data: candidateRows, error: candidateError } = await supabase
    .from("candidates")
    .select(
      "id,name,rank,final_score,semantic_score,keyword_score,skill_score,matched_skills,missing_skills",
    )
    .eq("analysis_id", analysisId.data);
  if (candidateError) {
    return NextResponse.json(
      {
        error: "Stored ranking evidence could not be retrieved.",
        code: "RETRIEVAL_ERROR",
      },
      { status: 502 },
    );
  }

  const sources: RagEvidence[] = selected.map((match, index) => ({
    sourceId: `S${index + 1}`,
    candidateId: match.candidate_id,
    candidateName:
      candidateRows?.find((c) => c.id === match.candidate_id)?.name ??
      metadataString(match.metadata, "candidateName"),
    documentId: match.document_id,
    documentType: match.document_type,
    filename: match.filename,
    pageNumber: match.page_number,
    section: match.section_label,
    chunkIndex: match.chunk_index,
    excerpt: match.content.slice(0, 1_200),
    similarity: Number(match.similarity),
  }));
  if (
    comparison &&
    !sources.some((s) => s.documentType === "JOB_DESCRIPTION")
  ) {
    const { data: jdDocuments, error: jdError } = await supabase
      .from("documents")
      .select("id,filename")
      .eq("analysis_id", analysisId.data)
      .eq("document_type", "JOB_DESCRIPTION")
      .eq("status", "READY")
      .limit(1);
    if (jdError)
      return NextResponse.json(
        {
          error: "Job description evidence could not be retrieved.",
          code: "RETRIEVAL_ERROR",
        },
        { status: 502 },
      );
    const jd = jdDocuments?.[0];
    if (jd) {
      const { data: jdChunks, error: jdChunkError } = await supabase
        .from("document_chunks")
        .select("document_id,content,page_number,section_label,chunk_index")
        .eq("analysis_id", analysisId.data)
        .eq("document_id", jd.id)
        .eq("document_type", "JOB_DESCRIPTION")
        .order("chunk_index")
        .limit(2);
      if (jdChunkError)
        return NextResponse.json(
          {
            error: "Job description evidence could not be retrieved.",
            code: "RETRIEVAL_ERROR",
          },
          { status: 502 },
        );
      for (const chunk of jdChunks ?? [])
        sources.push({
          sourceId: `S${sources.length + 1}`,
          candidateId: null,
          candidateName: null,
          documentId: jd.id,
          documentType: "JOB_DESCRIPTION",
          filename: jd.filename,
          pageNumber: chunk.page_number,
          section: chunk.section_label,
          chunkIndex: chunk.chunk_index,
          excerpt: chunk.content.slice(0, 1200),
          similarity: null,
        });
    }
  }
  // Include owned deterministic requirement references so a top-k limit cannot
  // silently exclude one of the compared candidates.
  for (const candidate of comparison?.candidates ?? [])
    for (const reference of candidate.strongestEvidence) {
      if (
        sources.some(
          (s) =>
            s.documentId === reference.documentId &&
            s.chunkIndex === reference.chunkIndex,
        )
      )
        continue;
      sources.push({
        sourceId: `S${sources.length + 1}`,
        candidateId: candidate.candidate.id,
        candidateName: candidate.candidate.name,
        documentId: reference.documentId,
        documentType: "RESUME",
        filename: reference.filename,
        pageNumber: reference.pageNumber,
        section: reference.section,
        chunkIndex: reference.chunkIndex ?? -1,
        excerpt: reference.excerpt,
        similarity: null,
      });
    }
  try {
    const answer = await answerRecruiterQuestion({
      question: body.data.question,
      evidence: sources,
      candidates: (candidateRows ?? [])
        .filter((c) => !comparison || selectedIds.has(c.id))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          rank: candidate.rank,
          finalScore: candidate.final_score,
          semanticScore: candidate.semantic_score,
          keywordScore: candidate.keyword_score,
          skillScore: candidate.skill_score,
          matchedSkills: candidate.matched_skills,
          missingSkills: candidate.missing_skills,
          requirementEvidence: comparison?.candidates
            .find((c) => c.candidate.id === candidate.id)
            ?.skills.map(
              ({ skill, status, requirementType, storedMatched }) => ({
                skill,
                status,
                requirementType,
                storedMatched,
              }),
            ),
        })),
    });

    return NextResponse.json({ answer, sources });
  } catch (error) {
    const rateLimited = errorStatus(error) === 429;
    return NextResponse.json(
      {
        error: rateLimited
          ? "Forma. is receiving too many questions. Try again shortly."
          : "The AI service could not produce an answer right now.",
        code: rateLimited ? "RATE_LIMITED" : "OPENAI_ERROR",
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
}
