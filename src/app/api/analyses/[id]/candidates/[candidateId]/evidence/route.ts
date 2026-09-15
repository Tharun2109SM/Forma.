import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> },
) {
  const route = await params;
  const analysisId = z.uuid().safeParse(route.id);
  const candidateId = z.uuid().safeParse(route.candidateId);
  if (!analysisId.success || !candidateId.success) {
    return NextResponse.json({ error: "Invalid candidate." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const { data: analysis } = await supabase.from("analyses")
    .select("id")
    .eq("id", analysisId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  const { data: candidate } = await supabase.from("candidates")
    .select("id,resume_filename")
    .eq("id", candidateId.data)
    .eq("analysis_id", analysisId.data)
    .maybeSingle();
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const { data: chunks, error } = await supabase.from("document_chunks")
    .select("id,content,page_number,section_label,chunk_index")
    .eq("analysis_id", analysisId.data)
    .eq("candidate_id", candidateId.data)
    .order("chunk_index", { ascending: true })
    .limit(12);
  if (error) return NextResponse.json({ error: "Evidence is unavailable." }, { status: 500 });

  return NextResponse.json({
    candidateId: candidate.id,
    evidence: (chunks ?? []).map((chunk) => ({
      id: chunk.id,
      excerpt: chunk.content,
      pageNumber: chunk.page_number,
      section: chunk.section_label,
      filename: candidate.resume_filename,
    })),
  });
}
