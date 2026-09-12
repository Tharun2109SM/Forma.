"use client";

import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisWorkspaceData } from "@/lib/data/analysis";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { DocumentStatus, DocumentType } from "@/types/database";

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
  document_type: DocumentType;
  status: DocumentStatus;
  extraction_method: "NATIVE" | "OCR" | null;
  ocr_used: boolean;
  error_message: string | null;
  updated_at: string;
};

type StatusResponse = {
  documents: ProcessingDocument[];
  chunkCount: number;
  ready: boolean;
};

type AskSource = {
  sourceId: string;
  candidateName: string | null;
  filename: string;
  pageNumber: number | null;
  excerpt: string;
};

function RecruiterAsk({ analysisId }: { analysisId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<AskSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analysis/${analysisId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        sources?: AskSource[];
        error?: string;
      };
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? "Question failed.");
      setAnswer(payload.answer);
      setSources(payload.sources ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The question could not be answered.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rag-panel" aria-labelledby="rag-title">
      <div className="processing-stages-header">
        <span>KNOWLEDGE BASE / READY</span>
        <span>EVIDENCE-GROUNDED</span>
      </div>
      <div className="rag-panel-body">
        <h2 id="rag-title">Ask across every uploaded PDF</h2>
        <p>Forma. will answer only from this analysis and return the supporting sources.</p>
        <form onSubmit={ask}>
          <input
            aria-label="Question about this candidate pool"
            maxLength={1_000}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Who has the strongest backend API experience?"
            value={question}
          />
          <button disabled={loading || question.trim().length < 3} type="submit">
            {loading ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
            Ask
          </button>
        </form>
        {error && <p className="upload-error">{error}</p>}
        {answer && (
          <div className="rag-answer" aria-live="polite">
            <p>{answer}</p>
            {sources.length > 0 && (
              <ol>
                {sources.map((source) => (
                  <li key={source.sourceId}>
                    <strong>
                      [{source.sourceId}] {source.candidateName ?? "Job description"}
                    </strong>
                    <span>
                      {source.filename}
                      {source.pageNumber ? ` · Page ${source.pageNumber}` : ""}
                    </span>
                    <p>“{source.excerpt}”</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProcessingView({
  activeStage,
  analysis,
}: {
  activeStage: number;
  analysis: AnalysisWorkspaceData;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const processingRef = useRef(false);

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
  }, [analysis.id, analysis.isSample]);

  useEffect(() => {
    if (analysis.isSample) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 2_500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [analysis.isSample, refresh]);

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

  const realCounts = status
    ? {
        uploaded: status.documents.filter((item) => item.status !== "UPLOADING").length,
        extracting: status.documents.filter((item) =>
          ["NORMALIZING", "INDEXING", "READY"].includes(item.status),
        ).length,
        ocr: status.documents.filter((item) => item.ocr_used || item.status === "OCR").length,
        ready: status.documents.filter((item) => item.status === "READY").length,
        failed: status.documents.filter((item) => item.status === "FAILED"),
      }
    : null;

  return (
    <main className="workspace-page processing-page">
      <Link className="back-link" href="/dashboard">
        <ArrowLeft size={15} strokeWidth={1.8} /> Shortlists
      </Link>
      <div className="processing-layout">
        <section className="processing-copy">
          <span className="page-kicker">ANALYSIS / PROCESSING</span>
          <h1>Finding the signal.</h1>
          <p>
            Forma. is structuring {analysis.candidateCount} candidate resumes against one role.
          </p>
          <div className="processing-job">
            <span>ROLE</span>
            <strong>{analysis.jobTitle ?? analysis.title}</strong>
            {analysis.companyName && <small>{analysis.companyName}</small>}
          </div>
          <p className="processing-note">
            {analysis.isSample
              ? "Preview processing uses labeled sample results and does not persist uploaded files."
              : "You can leave this page. The analysis remains saved to your account."}
          </p>
        </section>

        <section className="processing-stages" aria-label="Analysis progress" aria-live="polite">
          <div className="processing-stages-header">
            <span>PIPELINE</span>
            <span>{analysis.candidateCount} CANDIDATES</span>
          </div>
          {analysis.isSample ? <ol>
            {processingStages.map((stage, index) => {
              const complete = index < activeStage;
              const active = index === activeStage;
              return (
                <li
                  className={`${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`}
                  key={stage.code}
                >
                  <span className="stage-code">{stage.code}</span>
                  <strong>{stage.label}</strong>
                  <span className="stage-state">
                    {complete ? (
                      <Check size={14} />
                    ) : active ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      "WAIT"
                    )}
                  </span>
                </li>
              );
            })}
          </ol> : (
            <ol>
              {[
                ["UP", "Uploading documents", realCounts ? `${realCounts.uploaded} / ${status?.documents.length}` : "WAIT"],
                ["EXT", "Extracting text", realCounts ? `${realCounts.extracting} / ${status?.documents.length}` : "WAIT"],
                ["OCR", "OCR fallback", realCounts ? `${realCounts.ocr} PDFs` : "WAIT"],
                ["IDX", "Indexing knowledge base", status ? `${status.chunkCount} chunks` : "WAIT"],
                ["READY", "Searchable documents", realCounts ? `${realCounts.ready} / ${status?.documents.length}` : "WAIT"],
              ].map(([code, label, value]) => (
                <li className={code === "READY" && status?.ready ? "is-complete" : "is-active"} key={code}>
                  <span className="stage-code">{code}</span>
                  <strong>{label}</strong>
                  <span className="stage-state">{value}</span>
                </li>
              ))}
            </ol>
          )}
          {statusError && <p className="upload-error processing-error">{statusError}</p>}
          {realCounts && realCounts.failed.length > 0 && (
            <div className="failed-document-list">
              <span>FAILED DOCUMENTS</span>
              {realCounts.failed.map((document) => (
                <div key={document.id}>
                  <p><strong>{document.filename}</strong><small>{document.error_message}</small></p>
                  <button onClick={() => void retry(document)} type="button">
                    <RotateCcw size={13} /> Retry
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {!analysis.isSample && status?.ready && realCounts && realCounts.ready > 0 && (
        <RecruiterAsk analysisId={analysis.id} />
      )}
    </main>
  );
}
