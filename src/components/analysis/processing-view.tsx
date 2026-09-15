"use client";

import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisWorkspaceData } from "@/lib/data/analysis";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { DocumentStatus, DocumentType } from "@/types/database";
import "./processing-view.css";

export const processingStages = [
  { code: "PREP", label: "Preparing documents" },
  { code: "EXT", label: "Extracting resume text" },
  { code: "NORM", label: "Normalizing skills and aliases" },
  { code: "SEM", label: "Measuring semantic alignment" },
  { code: "KEY", label: "Checking explicit requirements" },
  { code: "RANK", label: "Resolving deterministic ranking" },
  { code: "EXP", label: "Preparing top-candidate explanations" },
] as const;

type ProcessingDocument = {
  id: string;
  filename: string;
  file_extension: string;
  document_type: DocumentType;
  status: DocumentStatus;
  extraction_method: "NATIVE" | "OCR" | null;
  ocr_used: boolean;
  error: string | null;
  updated_at: string;
};

type StatusResponse = {
  analysis: { status: "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED" };
  documents: ProcessingDocument[];
  chunkCount: number;
  ready: boolean;
};

const statusLabels: Record<DocumentStatus, string> = {
  QUEUED: "Queued",
  UPLOADING: "Uploading",
  UPLOADED: "Upload confirmed",
  EXTRACTING: "Extracting",
  OCR: "OCR fallback",
  NORMALIZING: "Normalizing",
  INDEXING: "Embedding / indexing",
  READY: "Indexed",
  FAILED: "Failed",
};

function documentStage(status: DocumentStatus) {
  if (status === "QUEUED" || status === "UPLOADING" || status === "UPLOADED") return "Upload";
  if (status === "EXTRACTING" || status === "OCR") return "Extract";
  if (status === "NORMALIZING") return "Normalize";
  if (status === "INDEXING") return "Embed / index";
  if (status === "READY") return "Ready";
  return "Needs attention";
}

export function ProcessingView({
  activeStage,
  analysis,
}: {
  activeStage: number;
  analysis: AnalysisWorkspaceData;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const stagesRef = useRef<HTMLOListElement>(null);

  const refresh = useCallback(async () => {
    if (analysis.isSample) return;
    try {
      const response = await fetch(`/api/analyses/${analysis.id}/status`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as StatusResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Status unavailable.");
      setStatus(payload);
      setStatusError(null);
      if (["COMPLETED", "FAILED"].includes(payload.analysis.status)) {
        router.refresh();
        return;
      }

      const staleBefore = Date.now() - 5 * 60 * 1_000;
      const stale = payload.documents.filter(
        (document) =>
          ["EXTRACTING", "OCR", "NORMALIZING", "INDEXING"].includes(document.status) &&
          new Date(document.updated_at).getTime() < staleBefore,
      );
      const uploaded = payload.documents.filter((document) => document.status === "UPLOADED");
      if ((uploaded.length > 0 || stale.length > 0) && !processingRef.current) {
        processingRef.current = true;
        await mapWithConcurrency(stale, 4, async (document) => {
          await fetch(`/api/analyses/${analysis.id}/documents/${document.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "retry" }),
          });
        });
        await mapWithConcurrency([...uploaded, ...stale], 4, async (document) => {
          await fetch(`/api/analyses/${analysis.id}/documents/${document.id}`, {
            method: "POST",
          });
        });
        processingRef.current = false;
      }
    } catch (cause) {
      processingRef.current = false;
      setStatusError(cause instanceof Error ? cause.message : "Processing status unavailable.");
    }
  }, [analysis.id, analysis.isSample, router]);

  useEffect(() => {
    if (analysis.isSample) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 2_500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [analysis.isSample, refresh]);

  useEffect(() => {
    if (!stagesRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void import("gsap").then(({ default: gsap }) => {
      if (cancelled || !stagesRef.current) return;
      const context = gsap.context(() => {
        gsap.from("li", {
          x: -16,
          opacity: 0,
          duration: 0.42,
          stagger: 0.055,
          ease: "power3.out",
        });
        gsap.from(".stage-state", {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.7,
          stagger: 0.055,
          ease: "power2.out",
        });
      }, stagesRef);
      cleanup = () => context.revert();
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [analysis.id]);

  async function retry(document: ProcessingDocument) {
    const response = await fetch(`/api/analyses/${analysis.id}/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setStatusError(payload.error ?? `Could not retry ${document.filename}.`);
      return;
    }
    await refresh();
  }

  const documents = status?.documents ?? [];
  const totalDocuments = documents.length;
  const failedDocuments = documents.filter((document) => document.status === "FAILED");
  const indexedDocuments = documents.filter((document) => document.status === "READY").length;
  const confirmedUploads = documents.filter((document) =>
    ["UPLOADED", "EXTRACTING", "OCR", "NORMALIZING", "INDEXING", "READY"].includes(document.status),
  ).length;
  const extractedDocuments = documents.filter((document) =>
    ["NORMALIZING", "INDEXING", "READY"].includes(document.status),
  ).length;
  const normalizedDocuments = documents.filter((document) =>
    ["INDEXING", "READY"].includes(document.status),
  ).length;
  const stageRows = [
    { code: "01", label: "Upload", detail: `${confirmedUploads} / ${totalDocuments} confirmed`, complete: confirmedUploads === totalDocuments && totalDocuments > 0, active: documents.some((document) => ["QUEUED", "UPLOADING", "UPLOADED"].includes(document.status)) },
    { code: "02", label: "Extract", detail: `${extractedDocuments} / ${totalDocuments} extracted`, complete: extractedDocuments === totalDocuments && totalDocuments > 0, active: documents.some((document) => ["EXTRACTING", "OCR"].includes(document.status)) },
    { code: "03", label: "Normalize", detail: `${normalizedDocuments} / ${totalDocuments} normalized`, complete: normalizedDocuments === totalDocuments && totalDocuments > 0, active: documents.some((document) => document.status === "NORMALIZING") },
    { code: "04", label: "Embed / index", detail: `${indexedDocuments} / ${totalDocuments} indexed`, complete: indexedDocuments === totalDocuments && totalDocuments > 0, active: documents.some((document) => document.status === "INDEXING") },
    { code: "05", label: "Rank", detail: status?.analysis.status === "COMPLETED" ? "Ranking complete" : status?.ready && indexedDocuments > 0 ? "Resolving ranking" : "Waiting for evidence", complete: status?.analysis.status === "COMPLETED", active: Boolean(status?.ready && indexedDocuments > 0 && status.analysis.status === "PROCESSING") },
  ];

  return (
    <main className="workspace-page processing-page processing-workspace">
      <Link className="back-link" href="/app/analyses">
        <ArrowLeft size={15} strokeWidth={1.8} /> Analyses
      </Link>
      <header className="processing-workspace-header">
        <div>
          <span className="page-kicker">ANALYSIS / {analysis.isSample ? "SAMPLE SEQUENCE" : "LIVE PROCESSING"}</span>
          <h1>Building the evidence.</h1>
          <p>Forma. is structuring {analysis.candidateCount} candidate documents against one role.</p>
        </div>
        <div className="processing-role-record">
          <span>ROLE / REFERENCE</span>
          <strong>{analysis.jobTitle ?? analysis.title}</strong>
          {analysis.companyName && <small>{analysis.companyName}</small>}
          <span className="processing-role-state" role="status">
            {analysis.isSample ? "Preview only" : status?.analysis.status ?? "Connecting to analysis"}
          </span>
        </div>
      </header>

      <div className="processing-workspace-main">
        <section className="processing-stages processing-workspace-stages" aria-labelledby="processing-pipeline-title">
          <div className="processing-stages-header">
            <h2 id="processing-pipeline-title">Pipeline</h2>
            <span>{analysis.isSample ? "SAMPLE" : `${indexedDocuments} / ${totalDocuments || "—"} INDEXED`}</span>
          </div>
          {analysis.isSample ? (
            <ol ref={stagesRef}>
              {processingStages.map((stage, index) => {
                const complete = index < activeStage;
                const active = index === activeStage;
                return (
                  <li className={`${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`} key={stage.code}>
                    <span className="stage-code">{stage.code}</span>
                    <strong>{stage.label}</strong>
                    <span className="stage-state">{complete ? <Check size={14} /> : active ? <LoaderCircle className="spin" size={14} /> : "WAIT"}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <ol ref={stagesRef}>
              {stageRows.map((stage) => (
                <li className={`${stage.complete ? "is-complete" : ""} ${stage.active ? "is-active" : ""}`} key={stage.code}>
                  <span className="stage-code">{stage.code}</span>
                  <strong>{stage.label}</strong>
                  <span className="stage-state">{status ? stage.detail : "Syncing"}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="processing-workspace-note">
            {analysis.isSample
              ? "This sample sequence is illustrative and does not process uploaded files."
              : "Keep this page open while processing runs. If you leave, return here to resume."}
          </p>
        </section>

        <section className="processing-document-panel" aria-labelledby="processing-documents-title">
          <div className="processing-document-heading">
            <div>
              <span className="page-kicker">DOCUMENT INTELLIGENCE</span>
              <h2 id="processing-documents-title">Document states</h2>
            </div>
            <div className="processing-document-stats" aria-live="polite">
              <span>{status ? `${totalDocuments} DOCUMENTS` : "SYNCING"}</span>
              <span>{status ? `${status.chunkCount} CHUNKS` : "— CHUNKS"}</span>
              {failedDocuments.length > 0 && <span className="is-error">{failedDocuments.length} FAILED</span>}
            </div>
          </div>
          {statusError && <p className="processing-workspace-error" role="alert">{statusError}</p>}
          {analysis.isSample ? (
            <div className="processing-document-empty">
              <strong>No live document states in preview.</strong>
              <p>Run an authenticated analysis to track individual uploads, extraction, and indexing.</p>
            </div>
          ) : !status ? (
            <div className="processing-document-empty" role="status">
              <LoaderCircle className="spin" aria-hidden="true" size={16} />
              <p>Loading document states…</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="processing-document-empty"><p>No documents are attached to this analysis yet.</p></div>
          ) : (
            <div className="processing-document-list">
              <div className="processing-document-table-head" aria-hidden="true">
                <span>DOC</span><span>DOCUMENT</span><span>PHASE</span><span>STATE</span><span>METHOD</span><span />
              </div>
              <ol>
                {documents.map((document, index) => (
                  <li className={document.status === "FAILED" ? "is-failed" : document.status === "READY" ? "is-ready" : ""} key={document.id}>
                    <span className="processing-document-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="processing-document-name">
                      <strong title={document.filename}>{document.filename}</strong>
                      <small>{document.document_type === "JOB_DESCRIPTION" ? "JOB DESCRIPTION" : "CANDIDATE"} / {document.file_extension.toUpperCase()}</small>
                    </div>
                    <span className="processing-document-phase">{documentStage(document.status)}</span>
                    <span className={`processing-document-status processing-document-status-${document.status.toLowerCase()}`}>
                      {statusLabels[document.status]}
                    </span>
                    <span className="processing-document-method">
                      {document.ocr_used || document.status === "OCR" ? "OCR" : document.extraction_method ?? "—"}
                    </span>
                    <div className="processing-document-action">
                      {document.status === "FAILED" && (
                        <button aria-label={`Retry ${document.filename}`} onClick={() => void retry(document)} type="button">
                          <RotateCcw aria-hidden="true" size={13} /> Retry
                        </button>
                      )}
                    </div>
                    {document.status === "FAILED" && document.error && (
                      <p className="processing-document-error">{document.error}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
