"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Minus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, type RefObject } from "react";
import type { CandidateResult } from "@/lib/data/demo-candidates";
import { CandidateEvidence } from "@/components/analysis/candidate-evidence";
import { NotEvidencedLabel } from "@/components/analysis/candidate-evidence";
import type { CandidateEvidenceData } from "@/lib/evidence/derive";
import type { ChatSource } from "./ask-forma-drawer";
import { normalizeSkill } from "@/lib/ranking/normalize";
import { DownloadReport } from "./download-report";

function SignalRow({
  code,
  label,
  score,
  weight,
}: {
  code: string;
  label: string;
  score: number;
  weight: string;
}) {
  return (
    <div className="drawer-signal-row">
      <span className="signal-code">{code}</span>
      <span>{label}</span>
      <i aria-hidden="true">
        <b style={{ width: `${score}%` }} />
      </i>
      <strong>{score.toFixed(1)}</strong>
      <small>{weight}</small>
    </div>
  );
}

export function CandidateDrawer({
  candidate,
  onClose,
  returnFocusRef,
  totalCandidates,
  analysisId,
  isSample,
  initialSkill,
  evidenceData,
  initialSource,
  citation,
}: {
  candidate: CandidateResult | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  totalCandidates: number;
  analysisId: string;
  isSample: boolean;
  initialSkill?: string;
  evidenceData?: CandidateEvidenceData;
  initialSource?: { documentId: string; chunkIndex: number };
  citation?: ChatSource;
}) {
  const [view, setView] = useState<"overview" | "evidence">(
    initialSkill || initialSource ? "evidence" : "overview",
  );
  const [skill, setSkill] = useState(initialSkill);
  const reducedMotion = useReducedMotion();
  const metricsAvailable =
    !evidenceData ||
    [
      evidenceData.candidate.finalScore,
      evidenceData.candidate.semanticScore,
      evidenceData.candidate.keywordScore,
      evidenceData.candidate.coverageScore,
    ].every((n) => n !== null);
  return (
    <Dialog.Root
      open={Boolean(candidate)}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content
          className="candidate-drawer"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          {candidate && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="drawer-motion-shell"
              initial={reducedMotion ? false : { opacity: 0, x: 28 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="drawer-header">
                <div>
                  <span className="page-kicker">
                    CANDIDATE /{" "}
                    {evidenceData && evidenceData.candidate.rank === null
                      ? "UNRANKED"
                      : String(candidate.rank).padStart(2, "0")}
                  </span>
                  <Dialog.Title>{candidate.name}</Dialog.Title>
                  <Dialog.Description>
                    {candidate.resumeFilename}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button aria-label="Close candidate details" type="button">
                    <X size={18} strokeWidth={1.8} />
                  </button>
                </Dialog.Close>
              </header>

              <div className="candidate-report-action">
                <DownloadReport analysisId={analysisId} type="candidate" candidateIds={[candidate.id]} disabled={isSample} disabledReason="Reports require a real completed analysis." />
              </div>

              <nav
                className="candidate-detail-nav"
                aria-label="Candidate detail views"
              >
                <button
                  type="button"
                  disabled={!metricsAvailable}
                  aria-pressed={view === "overview"}
                  onClick={() => setView("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  aria-pressed={view === "evidence"}
                  onClick={() => setView("evidence")}
                >
                  Evidence & source
                </button>
              </nav>

              {view === "overview" && (
                <>
                  <div className="drawer-score-hero">
                    <div>
                      <span>FINAL SCORE</span>
                      <strong>{candidate.finalScore.toFixed(1)}</strong>
                    </div>
                    <p>
                      Rank <b>#{String(candidate.rank).padStart(2, "0")}</b> of{" "}
                      {totalCandidates} candidates
                    </p>
                  </div>

                  <section
                    className="drawer-section"
                    aria-labelledby="signals-title"
                  >
                    <div className="drawer-section-heading">
                      <h2 id="signals-title">
                        Why {candidate.finalScore.toFixed(1)}?
                      </h2>
                      <span>FIXED WEIGHTS</span>
                    </div>
                    <div className="drawer-signals">
                      <SignalRow
                        code="SEM"
                        label="Semantic alignment"
                        score={candidate.semanticScore}
                        weight="50%"
                      />
                      <SignalRow
                        code="KEY"
                        label="Explicit skill match"
                        score={candidate.keywordScore}
                        weight="30%"
                      />
                      <SignalRow
                        code="REQ"
                        label="Required coverage"
                        score={candidate.skillScore}
                        weight="20%"
                      />
                    </div>
                    <p className="score-equation">
                      (0.50 × {candidate.semanticScore}) + (0.30 ×{" "}
                      {candidate.keywordScore}) + (0.20 × {candidate.skillScore}
                      ) = <strong>{candidate.finalScore.toFixed(1)}</strong>
                    </p>
                  </section>

                  <section
                    className="drawer-section skill-section"
                    aria-labelledby="skills-title"
                  >
                    <div className="drawer-section-heading">
                      <h2 id="skills-title">Skill evidence</h2>
                    </div>
                    <div className="skill-evidence-grid">
                      <div>
                        <span className="skill-list-label matched-label">
                          EVIDENCED SIGNALS
                        </span>
                        <ul>
                          {candidate.matchedSkills.map((skill) => (
                            <li key={skill}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSkill(normalizeSkill(skill));
                                  setView("evidence");
                                }}
                              >
                                <Check aria-hidden="true" size={13} /> {skill}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <NotEvidencedLabel />
                        <ul>
                          {candidate.missingSkills.map((skill) => (
                            <li key={skill}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSkill(normalizeSkill(skill));
                                  setView("evidence");
                                }}
                              >
                                <Minus aria-hidden="true" size={13} /> {skill}{" "}
                                <small>Required</small>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <section
                className="drawer-section"
                hidden={view !== "evidence"}
                aria-labelledby="evidence-title"
              >
                <div className="drawer-section-heading">
                  <h2 id="evidence-title">Resume evidence</h2>
                </div>
                {citation && (
                  <section className="evidence-selected">
                    <header>
                      <span className="app-meta-label">
                        ASK FORMA. / {citation.sourceId}
                      </span>
                      <h3>Cited source context</h3>
                      <p>
                        {citation.filename}
                        {citation.pageNumber
                          ? ` / Page ${citation.pageNumber}`
                          : ""}
                        {citation.section ? ` / ${citation.section}` : ""}
                      </p>
                    </header>
                    <blockquote className="evidence-source-context">
                      {citation.excerpt}
                    </blockquote>
                  </section>
                )}
                <CandidateEvidence
                  analysisId={analysisId}
                  candidateId={candidate.id}
                  filename={candidate.resumeFilename}
                  isSample={isSample}
                  sampleEvidence={candidate.evidence}
                  data={evidenceData}
                  initialSkill={skill}
                  initialSource={initialSource}
                />
              </section>

              {candidate.explanation && (
                <section
                  className="drawer-section explanation-section"
                  aria-labelledby="explanation-title"
                >
                  <span className="app-meta-label">TOP 3 EXPLANATION</span>
                  <h2 id="explanation-title">
                    Why this candidate ranked highly
                  </h2>
                  <p>
                    The stored rank reflects{" "}
                    {candidate.semanticScore.toFixed(1)} semantic alignment,{" "}
                    {candidate.keywordScore.toFixed(1)} explicit alignment, and{" "}
                    {candidate.skillScore.toFixed(1)} required coverage.
                    Requirements not evidenced in the resume contribute to
                    coverage according to the fixed ranking model; they are not
                    claims about the candidate’s abilities.
                  </p>
                </section>
              )}
            </motion.div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
