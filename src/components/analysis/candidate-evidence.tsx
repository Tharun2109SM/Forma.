"use client";

import { FileText, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

type EvidenceItem = {
  id: string;
  excerpt: string;
  pageNumber: number | null;
  section: string | null;
  filename: string;
};

export function CandidateEvidence({ analysisId, candidateId, sampleEvidence = [], filename, isSample = false }: {
  analysisId: string;
  candidateId: string;
  sampleEvidence?: string[];
  filename: string;
  isSample?: boolean;
}) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(!isSample);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSample) return;
    const controller = new AbortController();
    fetch(`/api/analyses/${analysisId}/candidates/${candidateId}/evidence`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { evidence?: EvidenceItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Evidence is unavailable.");
        setEvidence(payload.evidence ?? []);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Evidence is unavailable.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [analysisId, candidateId, isSample]);

  const items = isSample
    ? sampleEvidence.map((excerpt, index) => ({ id: `${candidateId}-${index}`, excerpt, pageNumber: null, section: null, filename }))
    : evidence;

  if (loading) return <p className="candidate-evidence-state" role="status"><LoaderCircle className="spin" size={15} /> Loading document evidence…</p>;
  if (error) return <p className="candidate-evidence-state" role="alert">{error}</p>;
  if (!items.length) return <p className="candidate-evidence-state">No indexed resume excerpts are available for this candidate yet.</p>;

  return (
    <ol className="candidate-evidence-list">
      {items.map((item, index) => (
        <li key={item.id}>
          <div className="candidate-evidence-source"><FileText size={14} aria-hidden="true" /><span>SOURCE {String(index + 1).padStart(2, "0")}</span><span>{item.filename}{item.pageNumber ? ` / page ${item.pageNumber}` : ""}{item.section ? ` / ${item.section}` : ""}</span></div>
          <p>{item.excerpt}</p>
        </li>
      ))}
    </ol>
  );
}
