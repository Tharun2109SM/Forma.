"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalysisWorkspaceData } from "@/lib/data/analysis";
import { ProcessingView, processingStages } from "@/components/analysis/processing-view";
import { ResultsView } from "@/components/analysis/results-view";

type WorkspaceMode = "processing" | "completed" | "failed";

export function AnalysisWorkspace({
  analysis,
  initialMode,
  resolvePreview,
}: {
  analysis: AnalysisWorkspaceData;
  initialMode: WorkspaceMode;
  resolvePreview: boolean;
}) {
  const [mode, setMode] = useState<WorkspaceMode>(initialMode);
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (mode !== "processing" || !resolvePreview) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intervalMs = reduced ? 90 : 620;
    const interval = window.setInterval(() => {
      setActiveStage((current) => {
        if (current >= processingStages.length - 1) {
          window.clearInterval(interval);
          window.setTimeout(() => setMode("completed"), reduced ? 100 : 520);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [mode, resolvePreview]);

  if (mode === "completed") {
    return <ResultsView analysis={{ ...analysis, status: "COMPLETED" }} />;
  }

  if (mode === "failed") {
    return (
      <main className="workspace-page failed-analysis-page">
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={15} /> Shortlists
        </Link>
        <section className="failure-state">
          <span className="failure-icon" aria-hidden="true">
            <AlertTriangle size={22} strokeWidth={1.6} />
          </span>
          <span className="app-meta-label">ANALYSIS / FAILED</span>
          <h1>We couldn’t complete this analysis.</h1>
          <p>
            The uploaded files are safe, but processing stopped before a ranking was produced.
            Start a new analysis or try again once the service connection is available.
          </p>
          <div>
            <Link className="primary-action" href="/analysis/new">
              New analysis <ArrowRight size={15} />
            </Link>
            <Link className="secondary-action" href="/dashboard">
              Return to shortlists
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <ProcessingView activeStage={activeStage} analysis={analysis} />;
}
