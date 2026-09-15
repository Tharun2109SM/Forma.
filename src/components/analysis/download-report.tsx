"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReportType } from "@/lib/reports/types";
import "./download-report.css";

const choices = [
  { type: "shortlist", label: "Full shortlist report", description: "Complete ranking + score/evidence summary" },
  { type: "top-candidates", label: "Top candidates report", description: "Top-ranked candidates with deeper document evidence" },
  { type: "ranking", label: "Ranking table", description: "Compact ranking-only PDF" },
] as const;

export function DownloadReport({ analysisId, candidateIds, type, disabled = false, disabledReason }: {
  analysisId: string;
  candidateIds?: string[];
  type?: "candidate" | "comparison";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ReportType>(type ?? "shortlist");
  const [state, setState] = useState<"idle" | "preparing" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const busy = state === "preparing";
  const label = type === "candidate" ? "Download report" : type === "comparison" ? "Download comparison" : "Download";

  async function download() {
    if (disabled || requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    setState("preparing"); setError("");
    try {
      const params = new URLSearchParams({ type: type ?? selection });
      if (type && candidateIds) params.set("candidateIds", candidateIds.join(","));
      const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/export/pdf?${params}`, { credentials: "same-origin", signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Could not generate report. Try again.");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Could not generate report. Try again.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const filename = response.headers.get("content-disposition")?.match(/filename="(forma-[a-z0-9-]+\.pdf)"/)?.[1] ?? "forma-report.pdf";
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setState("success");
    } catch (cause) {
      if (!controller.signal.aborted) { setState("error"); setError(cause instanceof Error ? cause.message : "Could not generate report. Try again."); }
    } finally { requestRef.current = null; }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="forma-report-trigger" type="button" disabled={disabled} title={disabled ? disabledReason : undefined}>
          {label} <ArrowDown size={14} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="forma-report-overlay" />
        <Dialog.Content className="forma-report-menu">
          <header>
            <Dialog.Title>DOWNLOAD REPORT</Dialog.Title>
            <Dialog.Close asChild><button type="button" aria-label="Close download menu"><X size={17} /></button></Dialog.Close>
          </header>
          <Dialog.Description>Export persisted Forma. results. Your analysis and rankings will not be changed.</Dialog.Description>
          {type ? (
            <div className="forma-report-single">{type === "candidate" ? "Candidate report" : "Candidate comparison report"}<small>Stored ranking, requirement evidence, and document sources</small></div>
          ) : (
            <fieldset disabled={busy}>
              <legend className="sr-only">Report type</legend>
              {choices.map((choice) => <label key={choice.type}>
                <input type="radio" name="forma-report-type" value={choice.type} checked={selection === choice.type} onChange={() => { setSelection(choice.type); setState("idle"); }} />
                <span>{choice.label}<small>{choice.description}</small></span>
              </label>)}
            </fieldset>
          )}
          <div className="forma-report-feedback" role={state === "error" ? "alert" : "status"} aria-live="polite">
            {busy && <><span>PREPARING REPORT</span><p>Generating {type === "comparison" ? "comparison" : type === "candidate" ? "candidate report" : "report"}...</p></>}
            {state === "success" && <p>Report downloaded</p>}
            {state === "error" && <><span>REPORT COULD NOT BE GENERATED</span><p>{error}</p><p>Your analysis has not been changed.</p></>}
          </div>
          <button className="forma-report-submit" type="button" disabled={busy || disabled} onClick={download}>
            {busy ? <><LoaderCircle className="forma-report-spinner" size={15} aria-hidden="true" /> Preparing report...</> : state === "error" ? "Try again" : "Download PDF"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
