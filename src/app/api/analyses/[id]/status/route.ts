import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid analysis." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("id,status,candidate_count")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (analysisError || !analysis) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  const [{ data: documents, error: documentError }, { count: chunkCount }] =
    await Promise.all([
      supabase
        .from("documents")
        .select(
          "id,document_type,filename,file_extension,status,extraction_method,page_count,ocr_used,error,updated_at,processed_at",
        )
        .eq("analysis_id", id.data)
        .order("created_at"),
      supabase
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .eq("analysis_id", id.data),
    ]);
  if (documentError) {
    return NextResponse.json({ error: "Document status is unavailable." }, { status: 500 });
  }

  const counts = (documents ?? []).reduce<Record<string, number>>((result, document) => {
    result[document.status] = (result[document.status] ?? 0) + 1;
    return result;
  }, {});

  return NextResponse.json({
    analysis,
    documents: documents ?? [],
    counts,
    chunkCount: chunkCount ?? 0,
    ready: (documents?.length ?? 0) > 0 && documents?.every((document) =>
      document.status === "READY" || document.status === "FAILED",
    ),
  });
}
