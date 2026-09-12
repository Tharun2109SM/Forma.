import { NextResponse } from "next/server";
import { z } from "zod";
import { processDocument } from "@/lib/documents/process";
import { getSignedUploadUrl, objectExists } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const paramsSchema = z.object({ id: z.uuid(), documentId: z.uuid() });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("uploaded") }),
  z.object({
    action: z.literal("failed"),
    error: z.string().trim().min(1).max(1_500),
  }),
  z.object({ action: z.literal("retry") }),
  z.object({ action: z.literal("prepare-upload") }),
]);

async function context(rawParams: Promise<{ id: string; documentId: string }>) {
  const parsed = paramsSchema.safeParse(await rawParams);
  if (!parsed.success) return { error: "Invalid document.", status: 400 } as const;

  const sessionClient = await createClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();
  if (error || !user) return { error: "Sign in to continue.", status: 401 } as const;

  const admin = createAdminClient();
  const { data: document, error: documentError } = await admin
    .from("documents")
    .select("*")
    .eq("id", parsed.data.documentId)
    .eq("analysis_id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (documentError || !document) {
    return { error: "Document not found.", status: 404 } as const;
  }
  return { admin, document, user, params: parsed.data } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const resolved = await context(params);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid document update." }, { status: 400 });
  }

  let status: "UPLOADED" | "FAILED";
  let documentError: string | null = null;
  if (body.data.action === "uploaded") {
    if (resolved.document.status !== "UPLOADING") {
      return NextResponse.json({ error: "Document is not awaiting upload." }, { status: 409 });
    }
    if (!(await objectExists(resolved.document.object_key))) {
      return NextResponse.json({ error: "Uploaded object was not found in R2." }, { status: 409 });
    }
    status = "UPLOADED";
  } else if (body.data.action === "failed") {
    status = "FAILED";
    documentError = body.data.error;
  } else if (body.data.action === "prepare-upload") {
    if (!["FAILED", "UPLOADING"].includes(resolved.document.status)) {
      return NextResponse.json(
        { error: "Document is not awaiting an upload retry." },
        { status: 409 },
      );
    }
    const { error } = await resolved.admin
      .from("documents")
      .update({ status: "UPLOADING", error: null, processed_at: null })
      .eq("id", resolved.document.id)
      .eq("user_id", resolved.user.id);
    if (error) {
      return NextResponse.json({ error: "Upload retry could not be prepared." }, { status: 500 });
    }
    return NextResponse.json({
      documentId: resolved.document.id,
      filename: resolved.document.filename,
      contentType: resolved.document.mime_type,
      url: await getSignedUploadUrl(
        resolved.document.object_key,
        resolved.document.mime_type,
      ),
    });
  } else {
    const updatedAt = new Date(resolved.document.updated_at).getTime();
    const stale = Date.now() - updatedAt > 5 * 60 * 1_000;
    if (resolved.document.status !== "FAILED" && !stale) {
      return NextResponse.json({ error: "Document is already processing." }, { status: 409 });
    }
    if (!(await objectExists(resolved.document.object_key))) {
      return NextResponse.json({ error: "The document is missing from R2." }, { status: 409 });
    }
    status = "UPLOADED";
  }

  const { data, error } = await resolved.admin
    .from("documents")
    .update({ status, error: documentError, processed_at: null })
    .eq("id", resolved.document.id)
    .eq("user_id", resolved.user.id)
    .select("id,status,error")
    .single();
  if (error) {
    return NextResponse.json({ error: "Document status could not be updated." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const resolved = await context(params);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  try {
    const result = await processDocument({
      documentId: resolved.document.id,
      analysisId: resolved.params.id,
      userId: resolved.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document processing failed." },
      { status: 500 },
    );
  }
}
