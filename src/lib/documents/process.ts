import "server-only";

import { chunkDocument } from "@/lib/documents/chunk";
import { extractDocument } from "@/lib/documents/extraction";
import { normalizeExtractedPages } from "@/lib/documents/normalize";
import { embedTexts } from "@/lib/openai/embeddings";
import { getObjectBytes } from "@/lib/r2/client";
import { finalizeAnalysisIfReady } from "@/lib/ranking/finalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, DocumentStatus } from "@/types/database";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Document processing failed.";
  return message.slice(0, 1_500);
}

function candidateName(filename: string, text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length >= 2 &&
        line.length <= 80 &&
        /^[\p{L}][\p{L}\p{M} .'-]+$/u.test(line) &&
        !/^(resume|curriculum vitae|profile|summary)$/i.test(line),
    );
  return firstLine ?? filename.replace(/\.[^.]+$/i, "").replace(/[_-]+/g, " ").trim();
}

async function setStatus(
  documentId: string,
  status: DocumentStatus,
  values: Database["public"]["Tables"]["documents"]["Update"] = {},
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("documents")
    .update({ ...values, status })
    .eq("id", documentId);
  if (error) throw error;
}

async function markFailed(documentId: string, error: unknown) {
  const supabase = createAdminClient();
  await supabase
    .from("documents")
    .update({
      status: "FAILED",
      error: safeMessage(error),
      processed_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}

async function claimDocument(
  documentId: string,
  analysisId: string,
  userId: string,
) {
  const supabase = createAdminClient();
  const { data: current, error: readError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("analysis_id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) throw new Error("Document not found.");
  if (current.status === "READY") return { document: current, alreadyReady: true };
  if (current.status !== "UPLOADED") {
    throw new Error(`Document is not ready to process (${current.status}).`);
  }

  const { data: claimed, error: claimError } = await supabase
    .from("documents")
    .update({
      status: "EXTRACTING",
      error: null,
      processing_attempts: current.processing_attempts + 1,
      processed_at: null,
    })
    .eq("id", current.id)
    .eq("status", "UPLOADED")
    .select("*")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) throw new Error("Document processing is already in progress.");
  return { document: claimed, alreadyReady: false };
}

export async function processDocument({
  documentId,
  analysisId,
  userId,
}: {
  documentId: string;
  analysisId: string;
  userId: string;
}) {
  const claim = await claimDocument(documentId, analysisId, userId);
  if (claim.alreadyReady) {
    return {
      id: claim.document.id,
      status: claim.document.status,
      chunks: null,
      extractionMethod: claim.document.extraction_method,
    };
  }

  const document = claim.document as DocumentRow;
  try {
    const bytes = await getObjectBytes(document.object_key);
    const extracted = await extractDocument({
      bytes,
      filename: document.filename,
      extension: document.file_extension,
      onOcrRequired: () => setStatus(document.id, "OCR"),
    });

    await setStatus(document.id, "NORMALIZING");
    const pages = normalizeExtractedPages(extracted.pages);
    const text = pages.join("\n\n").trim();

    const chunks = chunkDocument(pages, {
      pageNumbers: document.file_extension === "pdf",
    });
    if (chunks.length === 0) throw new Error("No searchable chunks could be created.");

    await setStatus(document.id, "INDEXING", {
      extraction_method: extracted.extractionMethod,
      extracted_text: text,
      page_count: extracted.pageCount ?? null,
      ocr_used: extracted.extractionMethod === "OCR",
      ocr_provider: extracted.extractionMethod === "OCR" ? "OPENAI" : null,
      char_count: text.length,
      error: null,
    });

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
    const supabase = createAdminClient();
    const { data: candidate } = document.candidate_id
      ? await supabase
          .from("candidates")
          .select("name,resume_filename")
          .eq("id", document.candidate_id)
          .maybeSingle()
      : { data: null };
    const inferredName = document.candidate_id
      ? candidate?.name ?? candidateName(document.filename, text)
      : null;

    const chunkRows = chunks.map((chunk, index) => ({
      analysis_id: document.analysis_id,
      document_id: document.id,
      candidate_id: document.candidate_id,
      user_id: document.user_id,
      document_type: document.document_type,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      section_label: chunk.sectionLabel,
      content: chunk.content,
      embedding: embeddings[index]!,
      token_count: chunk.tokenCount,
      metadata: {
        analysisId: document.analysis_id,
        documentId: document.id,
        documentType: document.document_type,
        candidateId: document.candidate_id,
        candidateName: inferredName,
        filename: document.filename,
        fileExtension: document.file_extension,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        sectionLabel: chunk.sectionLabel,
      },
    }));

    const { error: upsertError } = await supabase
      .from("document_chunks")
      .upsert(chunkRows, { onConflict: "document_id,chunk_index" });
    if (upsertError) throw upsertError;

    const { error: pruneError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", document.id)
      .gte("chunk_index", chunkRows.length);
    if (pruneError) throw pruneError;

    if (document.document_type === "JOB_DESCRIPTION") {
      const { error } = await supabase
        .from("analyses")
        .update({ jd_text: text })
        .eq("id", document.analysis_id)
        .eq("user_id", document.user_id);
      if (error) throw error;
    } else if (document.candidate_id) {
      const { error } = await supabase
        .from("candidates")
        .update({ name: inferredName, resume_text: text })
        .eq("id", document.candidate_id)
        .eq("analysis_id", document.analysis_id);
      if (error) throw error;
    }

    await setStatus(document.id, "READY", {
      processed_at: new Date().toISOString(),
      error: null,
    });

    await finalizeAnalysisIfReady(document.analysis_id, document.user_id);

    return {
      id: document.id,
      status: "READY" as const,
      chunks: chunks.length,
      extractionMethod: extracted.extractionMethod,
    };
  } catch (error) {
    await markFailed(document.id, error);
    await finalizeAnalysisIfReady(document.analysis_id, document.user_id).catch(
      () => undefined,
    );
    throw error;
  }
}
