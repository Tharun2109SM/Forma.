"use client";

import { Info, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  CandidateEvidenceData,
  EvidenceReference,
} from "@/lib/evidence/derive";
import "./evidence-comparison.css";

export const ABSENCE_NOTE =
  "Forma. found no supporting evidence for this requirement in the uploaded documents. This does not necessarily mean the candidate does not have the skill.";
export function NotEvidencedLabel() {
  return (
    <span className="absence-label">
      NOT EVIDENCED{" "}
      <button type="button" aria-label={ABSENCE_NOTE} title={ABSENCE_NOTE}>
        <Info size={13} />
      </button>
    </span>
  );
}
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    <>
      {text
        .split(new RegExp(`(${escaped})`, "gi"))
        .map((part, index) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={index}>{part}</mark>
          ) : (
            part
          ),
        )}
    </>
  );
}
export function EvidenceRail({
  references,
  expandedSource,
}: {
  references: EvidenceReference[];
  expandedSource?: { documentId: string; chunkIndex: number };
}) {
  const railRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let animation: { revert: () => void } | undefined;
    void import("animejs").then(({ animate, stagger }) => {
      if (cancelled || !railRef.current) return;
      animation = animate(railRef.current.querySelectorAll("li"), {
        opacity: [0, 1],
        translateY: [5, 0],
        duration: 200,
        delay: stagger(35),
        ease: "out(3)",
      });
    });
    return () => {
      cancelled = true;
      animation?.revert();
    };
  }, [references]);
  return (
    <ol className="evidence-timeline" ref={railRef}>
      {references.map((ref) => (
        <li key={ref.id}>
          <span className="evidence-node" aria-hidden="true" />
          <div className="evidence-meta">
            <strong>{ref.evidenceType}</strong>
            {ref.pageNumber !== null && <span>PAGE {ref.pageNumber}</span>}
            <span>{ref.matchType}</span>
          </div>
          {ref.section && <h4>{ref.section}</h4>}
          <blockquote>
            <Highlight text={ref.excerpt} term={ref.matchedTerm} />
          </blockquote>
          <div className="evidence-meta">
            <span>{ref.candidateName}</span>
            <span>{ref.filename}</span>
            {ref.matchType === "ALIASED" && (
              <span>ALIAS: {ref.matchedTerm}</span>
            )}
            <span>
              {ref.origin === "EXTRACTED_TEXT"
                ? "EXTRACTED TEXT · PAGE UNAVAILABLE"
                : `CHUNK ${ref.chunkIndex}`}
            </span>
          </div>
          <details
            open={
              (expandedSource?.documentId === ref.documentId &&
                expandedSource.chunkIndex === ref.chunkIndex) ||
              undefined
            }
          >
            <summary>View source context</summary>
            <p className="evidence-source-context">
              <Highlight text={ref.context} term={ref.matchedTerm} />
            </p>
          </details>
        </li>
      ))}
    </ol>
  );
}

export function CandidateEvidence({
  analysisId,
  candidateId,
  isSample = false,
  data,
  initialSkill,
  initialSource,
}: {
  analysisId: string;
  candidateId: string;
  isSample?: boolean;
  filename?: string;
  sampleEvidence?: string[];
  data?: CandidateEvidenceData;
  initialSkill?: string;
  initialSource?: { documentId: string; chunkIndex: number };
}) {
  const [loaded, setLoaded] = useState<CandidateEvidenceData | null>(
    data ?? null,
  );
  const [loading, setLoading] = useState(!data && !isSample);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [choice, setChoice] = useState({ skill: "", initial: initialSkill });
  useEffect(() => {
    if (data || isSample) return;
    const controller = new AbortController();
    fetch(
      `/api/analysis/${encodeURIComponent(analysisId)}/candidates/${encodeURIComponent(candidateId)}/evidence`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Your session expired. Sign in to inspect evidence."
              : response.status === 404
                ? "This candidate is no longer available in this analysis."
                : "Source evidence could not be loaded. Try again.",
          );
        return response.json() as Promise<CandidateEvidenceData>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setLoaded(payload);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Source evidence could not be loaded. Try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [analysisId, candidateId, data, isSample, retry]);
  const evidence = data ?? loaded;
  const skill =
    choice.initial === initialSkill
      ? choice.skill || initialSkill
      : initialSkill;
  function setSkill(skill: string) {
    setChoice({ skill, initial: initialSkill });
  }
  const selected =
    evidence?.skills.find((s) => s.skill === skill) ??
    evidence?.skills.find(
      (s) =>
        initialSource &&
        s.evidence.some(
          (e) =>
            e.documentId === initialSource.documentId &&
            e.chunkIndex === initialSource.chunkIndex,
        ),
    ) ??
    evidence?.skills[0];
  if (isSample)
    return (
      <p className="candidate-evidence-state">
        Source inspection requires actual uploaded documents. Sample records are
        not production evidence.
      </p>
    );
  if (loading)
    return (
      <p role="status" className="candidate-evidence-state">
        <LoaderCircle className="spin" size={15} /> Loading requirement
        evidence…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="candidate-evidence-state">
        {error}{" "}
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRetry((r) => r + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  if (!evidence?.skills.length)
    return (
      <p>No stored requirement signals are available for this candidate.</p>
    );
  return (
    <section className="requirement-evidence">
      <div className="evidence-skill-picker">
        <div>
          <span className="app-meta-label">
            EVIDENCED /{" "}
            {evidence.skills.filter((s) => s.status === "EVIDENCED").length}
          </span>
          <div className="evidence-skill-buttons">
            {evidence.skills
              .filter((s) => s.status === "EVIDENCED")
              .map((s) => (
                <button
                  type="button"
                  key={s.skill}
                  aria-pressed={selected?.skill === s.skill}
                  onClick={() => setSkill(s.skill)}
                >
                  {s.skill}
                  <small>{s.evidence.length}</small>
                </button>
              ))}
          </div>
        </div>
        <div>
          <NotEvidencedLabel />
          <div className="evidence-skill-buttons">
            {evidence.skills
              .filter((s) => s.status === "NOT_EVIDENCED")
              .map((s) => (
                <button
                  type="button"
                  key={s.skill}
                  aria-pressed={selected?.skill === s.skill}
                  onClick={() => setSkill(s.skill)}
                >
                  {s.skill}
                  <small>{s.requirementType}</small>
                </button>
              ))}
          </div>
        </div>
      </div>
      {selected && (
        <div className="evidence-selected" key={selected.skill}>
          <header>
            <span className="app-meta-label">
              {selected.requirementType.toUpperCase()} /{" "}
              {selected.status.replaceAll("_", " ")}
            </span>
            <h3>{selected.skill}</h3>
            <p>
              {selected.evidence.length
                ? `${selected.evidence.length} supporting ${selected.evidence.length === 1 ? "reference" : "references"} in uploaded resume text.`
                : "No supporting evidence found in the uploaded resume."}
            </p>
          </header>
          {selected.status === "NOT_EVIDENCED" ? (
            <p className="evidence-absence">
              {selected.storedMatched
                ? "The stored ranking marks this signal as matched, but no boundary-aware direct or alias source reference is inspectable. Ranking scores have not been changed."
                : ABSENCE_NOTE}
            </p>
          ) : (
            <EvidenceRail
              references={selected.evidence}
              expandedSource={initialSource}
            />
          )}
        </div>
      )}
      {initialSource &&
        !selected?.evidence.some(
          (e) =>
            e.documentId === initialSource.documentId &&
            e.chunkIndex === initialSource.chunkIndex,
        ) && (
          <p className="evidence-absence">
            This answer’s source is supporting context, not a deterministic
            skill reference. Read the cited excerpt above; do not treat it as a
            new skill match.
          </p>
        )}
      {evidence.documents.some((d) => d.status === "FAILED") && (
        <p className="evidence-absence">
          A source document failed processing. Available evidence may be
          incomplete.
        </p>
      )}
    </section>
  );
}
