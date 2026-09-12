import { NextResponse } from "next/server";
import { z } from "zod";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  getMaxResumesPerAnalysis,
  hasOpenAIEnv,
  hasR2Env,
  hasSupabaseEnv,
} from "@/lib/env";
import { jobDescriptionKey, resumeKey } from "@/lib/r2/keys";
import { getSignedUploadUrl } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PDF_SIZE = 15 * 1024 * 1024;
const pdfSchema = z.object({
  name: z.string().trim().min(5).max(255).refine(
    (name) => name.toLowerCase().endsWith(".pdf"),
    "Only PDF files are accepted.",
  ),
  size: z.number().int().positive().max(MAX_PDF_SIZE),
});

const requestSchema = z.object({
  title: z.string().trim().min(2).max(90),
  jobTitle: z.string().trim().max(90).optional(),
  companyName: z.string().trim().max(90).optional(),
  jobDescription: pdfSchema,
  resumes: z.array(pdfSchema).min(1).max(250),
});

export async function POST(request: Request) {
  try {
    const sessionClient = hasSupabaseEnv() ? await createClient() : null;
    const { data: authData, error: userError } = sessionClient
      ? await sessionClient.auth.getUser()
      : { data: { user: null }, error: null };

    if (hasSupabaseEnv() && (userError || !authData.user)) {
      return NextResponse.json({ error: "Sign in to create an analysis." }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the selected PDF files." },
        { status: 400 },
      );
    }

    if (!hasSupabaseEnv() || !authData.user) {
      return NextResponse.json({ id: "demo-new", preview: true, uploads: [] });
    }

    if (!hasR2Env() || !hasOpenAIEnv()) {
      return NextResponse.json(
        {
          error:
            "Production processing is not fully configured. R2 and OpenAI credentials are required.",
        },
        { status: 503 },
      );
    }

    if (parsed.data.resumes.length > getMaxResumesPerAnalysis()) {
      return NextResponse.json(
        { error: `Select at most ${getMaxResumesPerAnalysis()} resumes per analysis.` },
        { status: 400 },
      );
    }

    const user = authData.user;
    const supabase = createAdminClient();
    const analysisId = crypto.randomUUID();
    const candidates = parsed.data.resumes.map((file) => {
      const id = crypto.randomUUID();
      return {
        id,
        analysis_id: analysisId,
        resume_filename: file.name,
        resume_object_key: resumeKey(user.id, analysisId, id),
        matched_skills: [],
        missing_skills: [],
      };
    });
    const jdDocumentId = crypto.randomUUID();
    const jdKey = jobDescriptionKey(user.id, analysisId, jdDocumentId);
    const documents = [
      {
        id: jdDocumentId,
        analysis_id: analysisId,
        candidate_id: null,
        user_id: user.id,
        document_type: "JOB_DESCRIPTION" as const,
        filename: parsed.data.jobDescription.name,
        object_key: jdKey,
        file_size: parsed.data.jobDescription.size,
        status: "UPLOADING" as const,
      },
      ...candidates.map((candidate, index) => ({
        id: candidate.id,
        analysis_id: analysisId,
        candidate_id: candidate.id,
        user_id: user.id,
        document_type: "RESUME" as const,
        filename: parsed.data.resumes[index]!.name,
        object_key: candidate.resume_object_key,
        file_size: parsed.data.resumes[index]!.size,
        status: "UPLOADING" as const,
      })),
    ];

    const { error: analysisError } = await supabase.from("analyses").insert({
      id: analysisId,
      user_id: user.id,
      title: parsed.data.title,
      job_title: parsed.data.jobTitle || null,
      company_name: parsed.data.companyName || null,
      jd_filename: parsed.data.jobDescription.name,
      jd_object_key: jdKey,
      status: "UPLOADING",
    });
    if (analysisError) throw analysisError;

    const { error: candidateError } = await supabase.from("candidates").insert(candidates);
    if (candidateError) {
      await supabase.from("analyses").delete().eq("id", analysisId);
      throw candidateError;
    }


    const { error: documentError } = await supabase.from("documents").insert(documents);
    if (documentError) {
      await supabase.from("analyses").delete().eq("id", analysisId);
      throw documentError;
    }

    try {
      const definitions = [
        {
          field: "jobDescription" as const,
          index: 0,
          key: jdKey,
          documentId: jdDocumentId,
          filename: parsed.data.jobDescription.name,
        },
        ...candidates.map((candidate, index) => ({
          field: "resume" as const,
          index,
          key: candidate.resume_object_key,
          documentId: candidate.id,
          filename: parsed.data.resumes[index]!.name,
        })),
      ];
      const uploads = await mapWithConcurrency(definitions, 8, async (upload) => ({
          ...upload,
          url: await getSignedUploadUrl(upload.key),
        }));

      return NextResponse.json({ id: analysisId, preview: false, uploads }, { status: 201 });
    } catch (error) {
      await supabase.from("analyses").update({ status: "FAILED" }).eq("id", analysisId);
      throw error;
    }
  } catch {
    return NextResponse.json(
      { error: "We could not prepare this analysis. Check the connection and try again." },
      { status: 500 },
    );
  }
}
