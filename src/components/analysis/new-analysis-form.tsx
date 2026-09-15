"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileDropzone,
  type QueuedDocument,
  type QueuedDocumentStatus,
} from "@/components/analysis/file-dropzone";
import { mapWithConcurrency } from "@/lib/concurrency";
import "./new-analysis-form.css";

const UPLOAD_CONCURRENCY = Math.min(
  8,
  Math.max(1, Number(process.env.NEXT_PUBLIC_UPLOAD_CONCURRENCY ?? 4) || 4),
);
const MAX_RESUMES = Math.min(
  250,
  Math.max(1, Number(process.env.NEXT_PUBLIC_MAX_RESUMES_PER_ANALYSIS ?? 100) || 100),
);

type PreparedUpload = {
  field: "jobDescription" | "resume";
  index: number;
  url: string;
  documentId: string;
  filename: string;
  contentType: string;
};

type PreparedAnalysis = {
  id: string;
  preview: boolean;
  uploads: PreparedUpload[];
};

async function putWithRetry(url: string, file: File, contentType: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
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
  const [jobDescription, setJobDescription] = useState<QueuedDocument[]>([]);
  const [resumes, setResumes] = useState<QueuedDocument[]>([]);
  const [prepared, setPrepared] = useState<PreparedAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedDocuments = [...jobDescription, ...resumes];
  const selectedFormats = Array.from(
    new Set(
      selectedDocuments.map(({ file }) => file.name.split(".").at(-1)?.toUpperCase()),
    ),
  )
    .filter((format): format is string => Boolean(format))
    .join(" / ");

  function updateFile(
    field: "jobDescription" | "resume",
    index: number,
    status: QueuedDocumentStatus,
    values: Partial<QueuedDocument> = {},
  ) {
    const setter = field === "jobDescription" ? setJobDescription : setResumes;
    setter((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values, status } : item,
      ),
    );
  }

  function queuedFile(upload: PreparedUpload) {
    return upload.field === "jobDescription"
      ? jobDescription[0]
      : resumes[upload.index];
  }

  async function uploadOne(
    analysis: PreparedAnalysis,
    upload: PreparedUpload,
    refreshUrl: boolean,
  ) {
    const queued = queuedFile(upload);
    if (!queued) return false;
    updateFile(upload.field, upload.index, "UPLOADING", {
      documentId: upload.documentId,
      error: undefined,
    });
    try {
      let target = upload;
      if (refreshUrl) {
        const prepareResponse = await fetch(
          `/api/analyses/${analysis.id}/documents/${upload.documentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "prepare-upload" }),
          },
        );
        const preparedUpload = (await prepareResponse.json()) as Partial<PreparedUpload> & {
          error?: string;
        };
        if (!prepareResponse.ok || !preparedUpload.url || !preparedUpload.contentType) {
          throw new Error(preparedUpload.error ?? "Upload retry could not be prepared.");
        }
        target = { ...upload, ...preparedUpload };
      }

      await putWithRetry(target.url, queued.file, target.contentType);
      const statusResponse = await fetch(
        `/api/analyses/${analysis.id}/documents/${upload.documentId}`,
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
      await fetch(`/api/analyses/${analysis.id}/documents/${upload.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "failed", error: message }),
      }).catch(() => undefined);
      return false;
    }
  }

  async function retryFile(file: QueuedDocument) {
    if (!prepared || !file.documentId || submitting) return;
    const upload = prepared.uploads.find(
      (item) => item.documentId === file.documentId,
    );
    if (!upload) return;
    setSubmitting(true);
    setError(null);
    const succeeded = await uploadOne(prepared, upload, true);
    setError(
      succeeded
        ? `${file.file.name} uploaded. Run the analysis when every file is ready.`
        : `Could not upload ${file.file.name}.`,
    );
    setSubmitting(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !jobDescription[0] || resumes.length === 0) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    setSubmitting(true);
    setError(null);
    try {
      let analysis = prepared;
      const retryingPreparedAnalysis = Boolean(analysis);
      if (!analysis) {
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
              type: jobDescription[0].file.type,
            },
            resumes: resumes.map(({ file }) => ({
              name: file.name,
              size: file.size,
              type: file.type,
            })),
          }),
        });
        const payload = (await response.json()) as Partial<PreparedAnalysis> & {
          error?: string;
        };
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? "The analysis could not be created.");
        }
        analysis = {
          id: payload.id,
          preview: payload.preview ?? false,
          uploads: payload.uploads ?? [],
        };
        setPrepared(analysis);
      }

      if (!analysis.preview) {
        const uploads = analysis.uploads.filter((upload) => {
          const queued = queuedFile(upload);
          return queued && queued.status !== "UPLOADED" && queued.status !== "READY";
        });
        const uploadResults = await mapWithConcurrency(
          uploads,
          UPLOAD_CONCURRENCY,
          (upload) => uploadOne(analysis!, upload, retryingPreparedAnalysis),
        );

        if (uploadResults.some((result) => !result)) {
          setError("Some documents failed to upload. Retry each failed file before continuing.");
          setSubmitting(false);
          return;
        }

        const finalizeResponse = await fetch(`/api/analyses/${analysis.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            successfulUploads: jobDescription.length + resumes.length,
          }),
        });
        if (!finalizeResponse.ok) {
          throw new Error("The uploaded files could not be finalized.");
        }
      }

      router.push(
        `/app/analyses/${analysis.id}?state=processing${analysis.preview ? "&preview=1" : ""}`,
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
    <form className="new-analysis-form intake-form" onSubmit={handleSubmit}>
      <header className="new-analysis-header">
        <Link className="back-link" href="/app/analyses">
          <ArrowLeft size={15} strokeWidth={1.8} /> Analyses
        </Link>
        <div className="new-analysis-title">
          <div>
            <span className="page-kicker">WORKSPACE / NEW ANALYSIS</span>
            <h1>Build an analysis.</h1>
            <p>Define the role, add the source documents, then review before processing.</p>
          </div>
          {demoMode && <span className="demo-badge">PREVIEW MODE</span>}
        </div>
        <nav className="intake-wayfinding" aria-label="Analysis setup sections">
          <a href="#intake-role"><span>01</span> Role</a>
          <a href="#intake-job-description"><span>02</span> Job description</a>
          <a href="#intake-candidates"><span>03</span> Candidates</a>
          <a href="#intake-review"><span>04</span> Review</a>
        </nav>
      </header>

      <section className="intake-stage" id="intake-role" aria-labelledby="intake-role-title">
        <div className="intake-stage-heading">
          <span className="intake-stage-number">01 / ROLE</span>
          <div>
            <h2 id="intake-role-title">Set the context.</h2>
            <p>Give this analysis a name you will recognize in your workspace.</p>
          </div>
        </div>
        <div className="detail-fields intake-stage-body">
          <label className="field-label field-wide">
            Analysis title
            <input
              className="field-input"
              maxLength={90}
              name="title"
              placeholder="Senior Frontend Engineer shortlist"
              required
            />
          </label>
          <label className="field-label">
            <span className="intake-field-heading">Job title <em>Optional</em></span>
            <input
              className="field-input"
              maxLength={90}
              name="jobTitle"
              placeholder="Senior Frontend Engineer"
            />
          </label>
          <label className="field-label">
            <span className="intake-field-heading">Company <em>Optional</em></span>
            <input
              className="field-input"
              maxLength={90}
              name="companyName"
              placeholder="Northstar Labs"
            />
          </label>
        </div>
      </section>

      <section className="intake-stage intake-upload-stage" id="intake-job-description" aria-labelledby="intake-jd-title">
        <div className="intake-stage-heading">
          <span className="intake-stage-number">02 / JOB DESCRIPTION</span>
          <div>
            <h2 id="intake-jd-title">Add the reference.</h2>
            <p>Forma. uses this document as the source of requirements for every candidate.</p>
          </div>
        </div>
        <div className="intake-stage-body">
          <FileDropzone
            description="Add the single role description Forma. should use as the reference."
            disabled={submitting}
            files={jobDescription}
            id="job-description"
            label="Job description"
            multiple={false}
            onRetry={(file) => void retryFile(file)}
            onChange={setJobDescription}
            selectionLocked={Boolean(prepared)}
          />
        </div>
      </section>

      <section className="intake-stage intake-upload-stage" id="intake-candidates" aria-labelledby="intake-candidates-title">
        <div className="intake-stage-heading">
          <span className="intake-stage-number">03 / CANDIDATES</span>
          <div>
            <h2 id="intake-candidates-title">Add the people.</h2>
            <p>Upload one or many candidate documents. Each processed resume gets its own result.</p>
          </div>
        </div>
        <div className="intake-stage-body">
          <FileDropzone
            description="Add all candidate resumes. Successfully processed documents appear in the final ranking."
            disabled={submitting}
            files={resumes}
            id="candidate-resumes"
            label="Candidate resumes"
            multiple
            maxFiles={MAX_RESUMES}
            onChange={setResumes}
            onRetry={(file) => void retryFile(file)}
            selectionLocked={Boolean(prepared)}
          />
        </div>
      </section>

      <section className="intake-stage intake-review-stage" id="intake-review" aria-labelledby="intake-review-title">
        <div className="intake-stage-heading">
          <span className="intake-stage-number">04 / REVIEW</span>
          <div>
            <h2 id="intake-review-title">Check the intake.</h2>
            <p>Confirm the reference and candidate set before starting the analysis.</p>
          </div>
        </div>
        <div className="intake-stage-body">
          <dl className="intake-review-list">
            <div>
              <dt>Job description</dt>
              <dd title={jobDescription[0]?.file.name}>
                {jobDescription[0]?.file.name ?? "Waiting for a document"}
              </dd>
            </div>
            <div>
              <dt>Candidate documents</dt>
              <dd>{resumes.length} {resumes.length === 1 ? "resume" : "resumes"}</dd>
            </div>
            <div>
              <dt>Selected formats</dt>
              <dd>{selectedFormats || "None yet"}</dd>
            </div>
          </dl>
          <div className="intake-trust-note">
            <ShieldCheck aria-hidden="true" size={17} strokeWidth={1.7} />
            <p>
              {demoMode
                ? "Preview mode validates your selection but does not persist files."
                : "Documents are private to your account. Raw files are stored in R2, never in Postgres."}
            </p>
          </div>
        </div>
      </section>

      <footer className="analysis-submit-bar">
        <div className="intake-submit-status" aria-live="polite">
          <span>{jobDescription.length === 1 && resumes.length > 0 ? "READY TO START" : "INTAKE INCOMPLETE"}</span>
          <p>{jobDescription.length === 1 && resumes.length > 0
            ? `1 role document · ${resumes.length} ${resumes.length === 1 ? "candidate" : "candidates"}`
            : "Add one job description and at least one candidate."}</p>
        </div>
        <div className="submit-actions">
          <Link className="secondary-action" href="/app/analyses">
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
