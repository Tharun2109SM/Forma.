import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: unvalidatedId } = await params;
  const id = z.uuid().safeParse(unvalidatedId);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid analysis." }, { status: 400 });
  }

  const sessionClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const supabase = createAdminClient();
  await request.json().catch(() => ({}));
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("document_type,status")
    .eq("analysis_id", id.data)
    .eq("user_id", user.id);
  if (documentsError || !documents?.length) {
    return NextResponse.json({ error: "No uploaded documents were found." }, { status: 409 });
  }
  const jd = documents.find((document) => document.document_type === "JOB_DESCRIPTION");
  const hasProcessableResume = documents.some(
    (document) => document.document_type === "RESUME" && document.status === "UPLOADED",
  );
  const nextStatus =
    jd?.status === "UPLOADED" && hasProcessableResume ? "PROCESSING" : "FAILED";
  const { data, error } = await supabase
    .from("analyses")
    .update({ status: nextStatus })
    .eq("id", id.data)
    .eq("user_id", user.id)
    .eq("status", "UPLOADING")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "The upload could not be finalized." }, { status: 409 });
  }

  return NextResponse.json({
    id: data.id,
    status: nextStatus,
    failedUploads: documents.filter((document) => document.status === "FAILED").length,
  });
}
