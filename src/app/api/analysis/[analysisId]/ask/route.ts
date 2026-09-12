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
    .select("id")
    .eq("id", analysisId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  try {
    const queryEmbedding = await embedText(body.data.question);
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_document_chunks",
      {
        p_analysis_id: analysisId.data,
        p_query_embedding: queryEmbedding,
        p_match_count: 36,
        p_similarity_threshold: 0.2,
      },
    );
    if (matchError) throw matchError;

    const selected = diversify(matches ?? []);
    if (selected.length === 0) {
      return NextResponse.json({
        answer: "The uploaded documents do not contain enough relevant evidence to answer that question.",
        sources: [],
      });
    }

    const { data: candidateRows, error: candidateError } = await supabase
      .from("candidates")
      .select(
        "id,name,rank,final_score,semantic_score,keyword_score,skill_score,matched_skills,missing_skills",
      )
      .eq("analysis_id", analysisId.data);
    if (candidateError) throw candidateError;

    const sources: RagEvidence[] = selected.map((match, index) => ({
      sourceId: `S${index + 1}`,
      candidateId: match.candidate_id,
      candidateName: metadataString(match.metadata, "candidateName"),
      documentId: match.document_id,
      documentType: match.document_type,
      filename: match.filename,
      pageNumber: match.page_number,
      chunkIndex: match.chunk_index,
      excerpt: match.content.slice(0, 1_200),
      similarity: Number(match.similarity),
    }));
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
  } catch {
    return NextResponse.json(
      { error: "Forma could not answer that question right now." },
      { status: 500 },
    );
  }
}
