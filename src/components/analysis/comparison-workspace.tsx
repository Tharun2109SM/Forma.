"use client";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import type { CandidateEvidenceData } from "@/lib/evidence/derive";
import { CandidateDrawer } from "./candidate-drawer";
import { EvidenceRail, ABSENCE_NOTE } from "./candidate-evidence";
import { AskFormaWorkspace, type ChatSource } from "./ask-forma-drawer";
import { DownloadReport } from "./download-report";
import "./evidence-comparison.css";

const metrics = [
  { key: "finalScore", label: "Final" },
  { key: "semanticScore", label: "Semantic" },
  { key: "keywordScore", label: "Explicit" },
  { key: "coverageScore", label: "Required coverage" },
] as const;
export function ComparisonWorkspace({
  analysisId,
  title,
  candidates,
  totalCandidates,
}: {
  analysisId: string;
  title: string;
  candidates: CandidateEvidenceData[];
  totalCandidates: number;
}) {
  const [active, setActive] = useState(candidates[0].candidate.id);
  const [detail, setDetail] = useState<{
    id: string;
    skill?: string;
    source?: ChatSource;
  } | null>(null);
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const current = candidates.find((c) => c.candidate.id === active)!;
  const detailData = candidates.find((c) => c.candidate.id === detail?.id);
  const requirements = [
    ...new Map(
      candidates.flatMap((c) =>
        c.skills.map(
          (s) =>
            [s.skill, { skill: s.skill, type: s.requirementType }] as const,
        ),
      ),
    ).values(),
  ];
  const selectedIds = candidates.map((c) => c.candidate.id);
  function openEvidence(
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
    skill: string,
  ) {
    triggerRef.current = event.currentTarget;
    setDetail({ id, skill });
  }
  function cell(c: CandidateEvidenceData, skill: string) {
    const signal = c.skills.find((s) => s.skill === skill);
    return signal?.status === "EVIDENCED" ? (
      <button
        type="button"
        aria-label={`Inspect ${skill} evidence for ${c.candidate.name}`}
        onClick={(event) => openEvidence(event, c.candidate.id, skill)}
      >
        <Check size={13} /> Evidenced
      </button>
    ) : (
      <span className="not-evidenced" title={ABSENCE_NOTE}>
        — Not evidenced
      </span>
    );
  }
  function showSource(source: ChatSource, trigger: HTMLButtonElement) {
    if (
      source.candidateId &&
      candidates.some((c) => c.candidate.id === source.candidateId)
    ) {
      triggerRef.current = trigger;
      setDetail({ id: source.candidateId, source });
    }
  }
  const detailCandidate = detailData
    ? {
        id: detailData.candidate.id,
        name: detailData.candidate.name,
        resumeFilename: detailData.candidate.filename,
        email: null,
        rank: detailData.candidate.rank ?? 0,
        finalScore: detailData.candidate.finalScore ?? 0,
        semanticScore: detailData.candidate.semanticScore ?? 0,
        keywordScore: detailData.candidate.keywordScore ?? 0,
        skillScore: detailData.candidate.coverageScore ?? 0,
        matchedSkills: detailData.skills
          .filter((s) => s.storedMatched)
          .map((s) => s.skill),
        missingSkills: detailData.skills
          .filter((s) => !s.storedMatched && s.requirementType === "required")
          .map((s) => s.skill),
        evidence: [],
        explanation: null,
      }
    : null;
  return (
    <main className="workspace-page compare-page">
      <Link className="back-link" href={`/app/analyses/${analysisId}`}>
        <ArrowLeft size={15} /> Back to analysis
      </Link>
      <header className="compare-header">
        <div>
          <span className="page-kicker">
            COMPARE / {String(candidates.length).padStart(2, "0")} CANDIDATES
          </span>
          <h1>{title}</h1>
          <p>Side-by-side evidence against the same job description.</p>
        </div>
        <div className="compare-header-actions">
        <DownloadReport analysisId={analysisId} type="comparison" candidateIds={selectedIds} />
        <button
          type="button"
          onClick={() => {
            setAsking(true);
            requestAnimationFrame(() =>
              askRef.current?.scrollIntoView({
                behavior: reduced ? "instant" : "smooth",
              }),
            );
          }}
        >
          Ask Forma. about these candidates
        </button>
        </div>
      </header>
      <motion.div
        style={{ "--candidate-columns": candidates.length } as CSSProperties}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="compare-desktop compare-matrix-scroll">
          <table className="compare-matrix">
            <thead>
              <tr>
                <th scope="col">
                  STORED RANK SIGNALS
                  <br />
                  <br />
                  50% semantic
                  <br />
                  30% explicit
                  <br />
                  20% coverage
                </th>
                {candidates.map((c) => (
                  <th scope="col" key={c.candidate.id}>
                    <span>RANK #{c.candidate.rank ?? "—"}</span>
                    <strong>{c.candidate.name}</strong>
                    <small>{c.candidate.filename}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const values = candidates
                  .map((c) => c.candidate[metric.key])
                  .filter((n): n is number => n !== null);
                const max = Math.max(...values),
                  min = Math.min(...values);
                return (
                  <tr key={metric.key}>
                    <th scope="row">{metric.label.toUpperCase()}</th>
                    {candidates.map((c) => (
                      <td
                        key={c.candidate.id}
                        className={
                          c.candidate[metric.key] === max && max > min
                            ? "is-strongest"
                            : ""
                        }
                      >
                        <strong>
                          {c.candidate[metric.key]?.toFixed(1) ?? "—"}
                        </strong>
                        {max > min && c.candidate[metric.key] === max && (
                          <small>
                            +{(max - min).toFixed(1)} vs lowest selected
                          </small>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {(["required", "preferred", "general"] as const).map((type) => (
                <FragmentRows
                  key={type}
                  type={type}
                  requirements={requirements
                    .filter((r) => r.type === type)
                    .map((r) => r.skill)}
                  candidates={candidates}
                  cell={cell}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="compare-mobile">
          <nav className="compare-switcher" aria-label="Active candidate">
            {candidates.map((c) => (
              <button
                type="button"
                key={c.candidate.id}
                aria-pressed={active === c.candidate.id}
                onClick={() => setActive(c.candidate.id)}
              >
                {c.candidate.name}
              </button>
            ))}
          </nav>
          <h2>{current.candidate.name}</h2>
          <span className="app-meta-label">
            STORED RANK #{current.candidate.rank ?? "—"}
          </span>
          <div className="compare-mobile-metrics">
            {metrics.map((metric) => (
              <div key={metric.key}>
                <span>
                  {metric.label.toUpperCase()}
                  <small>
                    {candidates
                      .filter((c) => c !== current)
                      .map(
                        (c) =>
                          `${c.candidate.name}: ${c.candidate[metric.key]?.toFixed(1) ?? "—"}`,
                      )
                      .join(" · ")}
                  </small>
                </span>
                <strong>
                  {current.candidate[metric.key]?.toFixed(1) ?? "—"}
                </strong>
              </div>
            ))}
          </div>
          <h2>Requirement evidence</h2>
          {requirements.map((r) => (
            <section key={r.skill} className="compare-mobile-requirement">
              <span>
                {r.skill}{" "}
                <small className="app-meta-label">{r.type.toUpperCase()}</small>
              </span>
              {candidates.map((c) => (
                <div key={c.candidate.id}>
                  <span>{c.candidate.name}</span>
                  {cell(c, r.skill)}
                </div>
              ))}
            </section>
          ))}
        </div>
        <section className="compare-strongest">
          <header>
            <span className="app-meta-label">SOURCE-LED DIFFERENCES</span>
            <h2>Strongest requirement evidence</h2>
            <p className="comparison-feedback">
              Direct matches first, then aliases and section relevance. Stored
              scores and ranks remain unchanged.
            </p>
          </header>
          <div
            className="compare-strongest-grid"
            style={
              { "--candidate-columns": candidates.length } as CSSProperties
            }
          >
            {candidates.map((c) => (
              <section key={c.candidate.id}>
                <h3>{c.candidate.name}</h3>
                {c.strongestEvidence.length ? (
                  <EvidenceRail references={c.strongestEvidence} />
                ) : (
                  <p className="evidence-absence">
                    No inspectable direct or alias requirement references.{" "}
                    {c.documents.some((d) => d.status === "FAILED")
                      ? "A source failed processing."
                      : "Indexed evidence may be unavailable."}
                  </p>
                )}
              </section>
            ))}
          </div>
        </section>
      </motion.div>
      <div ref={askRef} className="compare-ask">
        {asking && (
          <>
            <h2>Ask about this comparison</h2>
            <AskFormaWorkspace
              analysisId={analysisId}
              candidateIds={selectedIds}
              candidateNames={candidates.map((c) => c.candidate.name)}
              onSourceSelect={showSource}
            />
          </>
        )}
      </div>
      <CandidateDrawer
        key={`${detail?.id}:${detail?.skill}:${detail?.source?.sourceId}`}
        candidate={detailCandidate}
        analysisId={analysisId}
        totalCandidates={totalCandidates}
        isSample={false}
        onClose={() => setDetail(null)}
        returnFocusRef={triggerRef}
        initialSkill={detail?.skill}
        evidenceData={detailData}
        citation={detail?.source}
        initialSource={
          detail?.source
            ? {
                documentId: detail.source.documentId,
                chunkIndex: detail.source.chunkIndex,
              }
            : undefined
        }
      />
      {detail?.source && (
        <div className="visually-hidden">
          Source excerpt: {detail.source.excerpt}
        </div>
      )}
    </main>
  );
}
function FragmentRows({
  type,
  requirements,
  candidates,
  cell,
}: {
  type: string;
  requirements: string[];
  candidates: CandidateEvidenceData[];
  cell: (c: CandidateEvidenceData, s: string) => React.ReactNode;
}) {
  return (
    <>
      {!!requirements.length && (
        <tr className="compare-group">
          <th colSpan={candidates.length + 1} scope="colgroup">
            {type.toUpperCase()} REQUIREMENTS
          </th>
        </tr>
      )}
      {requirements.map((skill) => (
        <tr key={skill}>
          <th scope="row">{skill}</th>
          {candidates.map((c) => (
            <td key={c.candidate.id}>{cell(c, skill)}</td>
          ))}
        </tr>
      ))}
    </>
  );
}
