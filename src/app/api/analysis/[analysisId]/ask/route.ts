import { NextResponse } from "next/server";
import { z } from "zod";
import { embedText } from "@/lib/openai/embeddings";
import { answerRecruiterQuestion, type RagEvidence } from "@/lib/rag/answer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  question: z.string().trim().min(3).max(1_000),
});

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function diversify<T extends { document_id: string; document_type: string }>(rows: T[]) {
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
    return NextResponse.json({ error: "Enter a valid analysis question." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to ask about this analysis." }, { status: 401 });
  }

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id,status")
    .eq("id", analysisId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  if (analysis.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Forma. is still indexing these documents.", code: "ANALYSIS_NOT_READY" },
      { status: 409 },
    );
  }

  const { count: indexedChunkCount, error: countError } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("analysis_id", analysisId.data);
  if (countError) {
    return NextResponse.json(
      { error: "Indexed evidence could not be checked.", code: "RETRIEVAL_ERROR" },
      { status: 502 },
    );
  }
  if (!indexedChunkCount) {
    return NextResponse.json(
      { error: "No indexed document evidence is available yet.", code: "NO_INDEXED_CHUNKS" },
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
      { error: "Document evidence could not be retrieved.", code: "RETRIEVAL_ERROR" },
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
        { error: "Document evidence could not be retrieved.", code: "RETRIEVAL_ERROR" },
        { status: 502 },
      );
    }
    matches = fallbackMatches ?? [];
  }

  const selected = diversify(matches);
  if (selected.length === 0) {
    return NextResponse.json(
      { error: "No sufficiently relevant document evidence was found.", code: "NO_RELEVANT_EVIDENCE" },
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
      { error: "Stored ranking evidence could not be retrieved.", code: "RETRIEVAL_ERROR" },
      { status: 502 },
    );
  }

  const sources: RagEvidence[] = selected.map((match, index) => ({
      sourceId: `S${index + 1}`,
      candidateId: match.candidate_id,
      candidateName: metadataString(match.metadata, "candidateName"),
      documentId: match.document_id,
      documentType: match.document_type,
      filename: match.filename,
      pageNumber: match.page_number,
      section: match.section_label,
      chunkIndex: match.chunk_index,
      excerpt: match.content.slice(0, 1_200),
      similarity: Number(match.similarity),
    }));
  try {
    const answer = await answerRecruiterQuestion({
      question: body.data.question,
      evidence: sources,
      candidates: (candidateRows ?? []).map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        rank: candidate.rank,
        finalScore: candidate.final_score,
        semanticScore: candidate.semantic_score,
        keywordScore: candidate.keyword_score,
        skillScore: candidate.skill_score,
        matchedSkills: candidate.matched_skills,
        missingSkills: candidate.missing_skills,
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
