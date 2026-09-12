"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileDropzone,
  type QueuedPdf,
  type QueuedPdfStatus,
} from "@/components/analysis/file-dropzone";
import { mapWithConcurrency } from "@/lib/concurrency";

const UPLOAD_CONCURRENCY = Math.min(
  8,
  Math.max(1, Number(process.env.NEXT_PUBLIC_UPLOAD_CONCURRENCY ?? 4) || 4),
);
const MAX_RESUMES = Math.min(
  250,
  Math.max(1, Number(process.env.NEXT_PUBLIC_MAX_RESUMES_PER_ANALYSIS ?? 100) || 100),
);

async function putWithRetry(url: string, file: File) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`R2 rejected the upload (${response.status}).`);
      }
      lastError = new Error(`Temporary upload failure (${response.status}).`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upload failed.");
    }
    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error("Upload failed.");
}

export function NewAnalysisForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [jobDescription, setJobDescription] = useState<QueuedPdf[]>([]);
  const [resumes, setResumes] = useState<QueuedPdf[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !jobDescription[0] || resumes.length === 0) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    setSubmitting(true);
    setError(null);
    function updateFile(
      field: "jobDescription" | "resume",
      index: number,
      status: QueuedPdfStatus,
      values: Partial<QueuedPdf> = {},
    ) {
      const setter = field === "jobDescription" ? setJobDescription : setResumes;
      setter((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...values, status } : item,
        ),
      );
    }

    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fields.get("title"),
          jobTitle: fields.get("jobTitle") || undefined,
          companyName: fields.get("companyName") || undefined,
          jobDescription: {
            name: jobDescription[0].file.name,
            size: jobDescription[0].file.size,
          },
          resumes: resumes.map(({ file }) => ({ name: file.name, size: file.size })),
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        preview?: boolean;
        uploads?: Array<{
          field: "jobDescription" | "resume";
          index: number;
          url: string;
          documentId: string;
          filename: string;
        }>;
        error?: string;
      };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "The analysis could not be created.");
      }
      if (!payload.preview) {
        const uploads = payload.uploads ?? [];
        const uploadResults = await mapWithConcurrency(
          uploads,
          UPLOAD_CONCURRENCY,
          async (upload) => {
            const queued =
              upload.field === "jobDescription"
                ? jobDescription[0]
                : resumes[upload.index];
            if (!queued) return false;
            updateFile(upload.field, upload.index, "UPLOADING", {
              documentId: upload.documentId,
              error: undefined,
            });
            try {
              await putWithRetry(upload.url, queued.file);
              const statusResponse = await fetch(
                `/api/analyses/${payload.id}/documents/${upload.documentId}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "uploaded" }),
                },
              );
              if (!statusResponse.ok) throw new Error("Upload could not be verified.");
              updateFile(upload.field, upload.index, "UPLOADED");
              return true;
            } catch (cause) {
              const message = cause instanceof Error ? cause.message : "Upload failed.";
              updateFile(upload.field, upload.index, "FAILED", { error: message });
              await fetch(`/api/analyses/${payload.id}/documents/${upload.documentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "failed", error: message }),
              }).catch(() => undefined);
              return false;
            }
          },
        );

        const finalizeResponse = await fetch(`/api/analyses/${payload.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            successfulUploads: uploadResults.filter(Boolean).length,
          }),
        });
        if (!finalizeResponse.ok) {
          throw new Error("The uploaded files could not be finalized.");
        }
      }

      router.push(
        `/analysis/${payload.id}?state=processing${payload.preview ? "&preview=1" : ""}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The analysis could not be created. Try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="new-analysis-form" onSubmit={handleSubmit}>
      <header className="new-analysis-header">
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={15} strokeWidth={1.8} /> Shortlists
        </Link>
        <div className="new-analysis-title">
          <div>
            <span className="page-kicker">NEW ANALYSIS / DRAFT</span>
            <h1>Create a candidate shortlist</h1>
            <p>Start with one role, then add every resume you want Forma. to compare.</p>
          </div>
          {demoMode && <span className="demo-badge">PREVIEW MODE</span>}
        </div>
      </header>

      <section className="analysis-details" aria-labelledby="details-title">
        <div className="analysis-details-heading">
          <span className="upload-index">00</span>
          <div>
            <h2 id="details-title">Analysis details</h2>
            <p>Name the shortlist so it is easy to reopen later.</p>
          </div>
        </div>
        <div className="detail-fields">
          <label className="field-label field-wide">
            Analysis title
            <input
              className="field-input"
              defaultValue="Frontend Engineer shortlist"
              maxLength={90}
              name="title"
              required
            />
          </label>
          <label className="field-label">
            Job title <span>Optional</span>
            <input
              className="field-input"
              maxLength={90}
              name="jobTitle"
              placeholder="Senior Frontend Engineer"
            />
          </label>
          <label className="field-label">
            Company <span>Optional</span>
            <input
              className="field-input"
              maxLength={90}
              name="companyName"
              placeholder="Northstar Labs"
            />
          </label>
        </div>
      </section>

      <FileDropzone
        description="Add the single role description Forma. should use as the reference."
        disabled={submitting}
        files={jobDescription}
        id="job-description"
        label="Job description"
        multiple={false}
        onChange={setJobDescription}
      />

      <FileDropzone
        description="Add all candidate resumes. Every valid PDF will appear in the final ranking."
        disabled={submitting}
        files={resumes}
        id="candidate-resumes"
        label="Candidate resumes"
        multiple
        maxFiles={MAX_RESUMES}
        onChange={setResumes}
      />

      <footer className="analysis-submit-bar">
        <div>
          <ShieldCheck size={16} strokeWidth={1.7} />
          <p>
            {demoMode
              ? "Preview mode validates your selection but does not persist files."
              : "PDFs are private to your account. Raw files are stored in R2, never in Postgres."}
          </p>
        </div>
        <div className="submit-actions">
          <Link className="secondary-action" href="/dashboard">
            Cancel
          </Link>
          <button
            className="primary-action"
            disabled={submitting || !jobDescription[0] || resumes.length === 0}
            type="submit"
          >
            {submitting ? (
              <>
                <LoaderCircle className="spin" size={16} /> Preparing…
              </>
            ) : (
              <>
                Run analysis <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </footer>

      <div aria-live="assertive">
        {error && <p className="analysis-form-error">{error}</p>}
      </div>
    </form>
  );
}
