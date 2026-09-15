"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, FileText, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { AnalysisWorkspaceData } from "@/lib/data/analysis";
import type { CandidateResult } from "@/lib/data/demo-candidates";
import { CandidateDrawer } from "@/components/analysis/candidate-drawer";
import { CandidateEvidence } from "@/components/analysis/candidate-evidence";
import {
  AskFormaWorkspace,
  type ChatSource,
} from "@/components/analysis/ask-forma-drawer";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DownloadReport } from "./download-report";
import "@/styles/analysis-workspace.css";
import "./evidence-comparison.css";

type Tab = "overview" | "ranking" | "candidates" | "evidence" | "ask";

const tabs: { id: Tab; label: string; code: string }[] = [
  { id: "overview", label: "Overview", code: "01" },
  { id: "ranking", label: "Ranking", code: "02" },
  { id: "candidates", label: "Candidates", code: "03" },
  { id: "evidence", label: "Evidence", code: "04" },
  { id: "ask", label: "Ask Forma.", code: "05" },
];

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function ScoreRail({ score, label }: { score: number; label: string }) {
  return (
    <span className="intel-score-rail" data-label={label}>
      <i aria-hidden="true">
        <b style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </i>
      <strong>{score.toFixed(0)}</strong>
    </span>
  );
}

function RankingRow({
  candidate,
  onSelect,
}: {
  candidate: CandidateResult;
  onSelect: (
    event: React.MouseEvent<HTMLButtonElement>,
    candidate: CandidateResult,
  ) => void;
}) {
  return (
    <button
      aria-label={`Open ${candidate.name}, ranked ${candidate.rank} with a final score of ${candidate.finalScore.toFixed(1)}`}
      className={`intel-ranking-row ${candidate.rank <= 3 ? "is-leading" : ""}`}
      onClick={(event) => onSelect(event, candidate)}
      type="button"
    >
      <span className="intel-rank">
        {String(candidate.rank).padStart(2, "0")}
      </span>
      <span className="intel-person">
        <strong>{candidate.name}</strong>
        <small>{candidate.resumeFilename}</small>
      </span>
      <span className="intel-skills">
        {candidate.matchedSkills.slice(0, 2).map((skill) => (
          <i key={skill}>
            <Check size={11} aria-hidden="true" /> {skill}
          </i>
        ))}
        {candidate.matchedSkills.length > 2 && (
          <small>+{candidate.matchedSkills.length - 2}</small>
        )}
      </span>
      <ScoreRail label="Semantic" score={candidate.semanticScore} />
      <ScoreRail label="Explicit" score={candidate.keywordScore} />
      <ScoreRail label="Coverage" score={candidate.skillScore} />
      <span className="intel-final" data-label="Final">
        {candidate.finalScore.toFixed(1)}
      </span>
      <ArrowUpRight className="intel-open" size={17} aria-hidden="true" />
    </button>
  );
}

export function ResultsView({
  analysis,
  initialCandidateId,
}: {
  analysis: AnalysisWorkspaceData;
  initialCandidateId?: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [selected, setSelected] = useState<CandidateResult | null>(
    () =>
      analysis.candidates.find(
        (candidate) => candidate.id === initialCandidateId,
      ) ?? null,
  );
  const [evidenceCandidateId, setEvidenceCandidateId] = useState(
    analysis.candidates[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [matchedFilter, setMatchedFilter] = useState("");
  const [missingFilter, setMissingFilter] = useState("");
  const [sort, setSort] = useState("rank");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareError, setCompareError] = useState("");
  const [citation, setCitation] = useState<ChatSource | undefined>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const askReady =
    !analysis.isSample &&
    analysis.status === "COMPLETED" &&
    analysis.indexedChunkCount > 0;
  const top = analysis.candidates[0];
  const allMatched = [
    ...new Set(
      analysis.candidates.flatMap((candidate) => candidate.matchedSkills),
    ),
  ].sort();
  const allMissing = [
    ...new Set(
      analysis.candidates.flatMap((candidate) => candidate.missingSkills),
    ),
  ].sort();
  const evidenceCandidate =
    analysis.candidates.find(
      (candidate) => candidate.id === evidenceCandidateId,
    ) ?? top;

  const filteredCandidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    const result = analysis.candidates.filter(
      (candidate) =>
        (!term ||
          `${candidate.name} ${candidate.resumeFilename} ${candidate.matchedSkills.join(" ")} ${candidate.missingSkills.join(" ")}`
            .toLowerCase()
            .includes(term)) &&
        (!matchedFilter || candidate.matchedSkills.includes(matchedFilter)) &&
        (!missingFilter || candidate.missingSkills.includes(missingFilter)),
    );
    if (sort === "name")
      return result.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "score")
      return result.sort((a, b) => b.finalScore - a.finalScore);
    return result.sort((a, b) => a.rank - b.rank);
  }, [analysis.candidates, matchedFilter, missingFilter, query, sort]);

  function selectCandidate(
    event: React.MouseEvent<HTMLButtonElement>,
    candidate: CandidateResult,
  ) {
    triggerRef.current = event.currentTarget;
    setCitation(undefined);
    setSelected(candidate);
  }
  function toggleCompare(id: string) {
    if (compareIds.includes(id)) {
      setCompareIds((ids) => ids.filter((v) => v !== id));
      setCompareError("");
      return;
    }
    if (compareIds.length >= 4) {
      setCompareError(
        "You can compare up to four candidates from this analysis.",
      );
      return;
    }
    setCompareIds((ids) => [...ids, id]);
    setCompareError("");
  }
  function compareCheckbox(candidate: CandidateResult) {
    return (
      <input
        className="compare-check"
        type="checkbox"
        aria-label={`Select ${candidate.name} for comparison`}
        checked={compareIds.includes(candidate.id)}
        onChange={() => toggleCompare(candidate.id)}
        disabled={
          analysis.isSample ||
          (!compareIds.includes(candidate.id) && compareIds.length >= 4)
        }
        title={
          analysis.isSample
            ? "Comparison requires actual uploaded candidate documents."
            : "Select up to four candidates"
        }
      />
    );
  }

  return (
    <main className="workspace-page intel-page">
      <Link className="back-link" href="/app/analyses">
        <ArrowLeft size={15} aria-hidden="true" /> Analyses
      </Link>

      <header className="intel-header">
        <div>
          <span className="page-kicker">
            ANALYSIS / {analysis.id.slice(0, 8).toUpperCase()}
          </span>
          <h1>{analysis.title}</h1>
          <p>
            {[analysis.jobTitle, analysis.companyName]
              .filter(Boolean)
              .join(" · ") || "Candidate analysis"}
          </p>
        </div>
        <div className="intel-header-facts">
          <StatusBadge status="COMPLETED" />
          <span>{analysis.candidateCount} candidates</span>
          <span>{dateFormatter.format(new Date(analysis.createdAt))}</span>
          <DownloadReport analysisId={analysis.id} disabled={analysis.isSample || analysis.status !== "COMPLETED"} disabledReason={analysis.isSample ? "Reports require a real completed analysis." : "Reports are available once the analysis is completed."} />
        </div>
      </header>

      {analysis.isSample && (
        <div className="intel-sample-note" role="note">
          <strong>SAMPLE RESULTS</strong>
          <span>
            These records demonstrate the workspace. Their scores did not come
            from a live analysis.
          </span>
        </div>
      )}

      <nav className="intel-tabs" role="tablist" aria-label="Analysis views">
        {tabs.map(({ id, label, code }) => (
          <button
            aria-controls={`intel-panel-${id}`}
            aria-selected={tab === id}
            className={tab === id ? "is-active" : ""}
            id={`intel-tab-${id}`}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            <small>{code}</small>
            {label}
          </button>
        ))}
      </nav>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        aria-labelledby={`intel-tab-${tab}`}
        id={`intel-panel-${tab}`}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        key={tab}
        role="tabpanel"
        transition={{ duration: 0.18 }}
      >
        {tab === "overview" && (
          <div className="intel-overview">
            <section className="intel-overview-main">
              <div className="intel-section-heading">
                <span className="app-meta-label">SHORTLIST / AT A GLANCE</span>
                <h2>Evidence first. Ranking second.</h2>
                <p>
                  Forma. measures each candidate against the same role and
                  explains the resulting order.
                </p>
              </div>
              {top ? (
                <div className="intel-top-candidate">
                  <span>TOP ALIGNED CANDIDATE</span>
                  <strong>{top.name}</strong>
                  <b>{top.finalScore.toFixed(1)}</b>
                  <p>
                    {`${top.matchedSkills.length} evidenced signals in the stored ranking. Required coverage: ${top.skillScore.toFixed(1)}.`}
                  </p>
                  <button
                    type="button"
                    onClick={(event) => selectCandidate(event, top)}
                  >
                    View candidate details <ArrowUpRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="saas-empty">
                  <span className="saas-eyebrow">NO RESULTS</span>
                  <h2>No candidates were ranked.</h2>
                  <p>
                    There are no completed candidate records in this analysis.
                  </p>
                </div>
              )}
              <div className="intel-section-heading intel-section-heading-small">
                <span className="app-meta-label">RANKING PREVIEW</span>
                <h2>Leading candidates</h2>
              </div>
              <div className="intel-preview-list">
                {analysis.candidates.slice(0, 5).map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={(event) => selectCandidate(event, candidate)}
                  >
                    <span>{String(candidate.rank).padStart(2, "0")}</span>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.matchedSkills.slice(0, 2).join(" · ")}
                    </small>
                    <b>{candidate.finalScore.toFixed(1)}</b>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </section>

            <aside className="intel-overview-rail">
              <span className="app-meta-label">ANALYSIS RECORD</span>
              <dl>
                <div>
                  <dt>Role</dt>
                  <dd>{analysis.jobTitle ?? analysis.title}</dd>
                </div>
                <div>
                  <dt>Company</dt>
                  <dd>{analysis.companyName ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt>Job description</dt>
                  <dd>{analysis.jdFilename ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{dateFormatter.format(new Date(analysis.createdAt))}</dd>
                </div>
                <div>
                  <dt>Indexed chunks</dt>
                  <dd>
                    {analysis.isSample ? "Sample" : analysis.indexedChunkCount}
                  </dd>
                </div>
              </dl>
              <div className="intel-formula">
                <span>DETERMINISTIC SCORE</span>
                <strong>
                  50 <i>/</i> 30 <i>/</i> 20
                </strong>
                <p>Semantic relevance · explicit match · required coverage</p>
              </div>
            </aside>
          </div>
        )}

        {tab === "ranking" && (
          <section className="intel-ranking" aria-label="Candidate ranking">
            <div className="intel-view-heading">
              <div>
                <span className="app-meta-label">DETERMINISTIC RANKING</span>
                <h2>Every signal, in one view.</h2>
              </div>
              <p>
                Final = 50% semantic + 30% explicit + 20% coverage. Select 2–4
                candidates to compare.
              </p>
            </div>
            {analysis.candidates.length ? (
              <>
                <div className="intel-ranking-head" aria-hidden="true">
                  <span>Rank</span>
                  <span>Candidate</span>
                  <span>Evidenced signals</span>
                  <span>Semantic</span>
                  <span>Explicit</span>
                  <span>Coverage</span>
                  <span>Final</span>
                  <span />
                </div>
                {analysis.candidates.map((candidate) => (
                  <div className="comparison-select-row" key={candidate.id}>
                    {compareCheckbox(candidate)}
                    <RankingRow
                      candidate={candidate}
                      onSelect={selectCandidate}
                    />
                  </div>
                ))}
              </>
            ) : (
              <div className="saas-empty">
                <h2>No ranking available.</h2>
                <p>This analysis has no completed candidate results.</p>
              </div>
            )}
          </section>
        )}

        {tab === "candidates" && (
          <section
            className="intel-candidates"
            aria-label="Candidates in this analysis"
          >
            <div className="intel-view-heading">
              <div>
                <span className="app-meta-label">CANDIDATE RECORDS</span>
                <h2>Explore the shortlist.</h2>
              </div>
              <p>
                {filteredCandidates.length} of {analysis.candidates.length}{" "}
                candidates
              </p>
            </div>
            <div className="intel-filters">
              <label>
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label="Search candidates"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or skill"
                  value={query}
                />
              </label>
              <select
                aria-label="Filter by evidenced signal"
                value={matchedFilter}
                onChange={(event) => setMatchedFilter(event.target.value)}
              >
                <option value="">All evidenced signals</option>
                {allMatched.map((skill) => (
                  <option key={skill}>{skill}</option>
                ))}
              </select>
              <select
                aria-label="Filter by requirement not evidenced"
                value={missingFilter}
                onChange={(event) => setMissingFilter(event.target.value)}
              >
                <option value="">All not-evidenced requirements</option>
                {allMissing.map((skill) => (
                  <option key={skill}>{skill}</option>
                ))}
              </select>
              <select
                aria-label="Sort candidates"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="rank">Rank order</option>
                <option value="score">Highest score</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
            {filteredCandidates.length ? (
              <div className="intel-candidate-list">
                {filteredCandidates.map((candidate) => (
                  <div className="comparison-select-row" key={candidate.id}>
                    {compareCheckbox(candidate)}
                    <button
                      type="button"
                      onClick={(event) => selectCandidate(event, candidate)}
                    >
                      <span className="intel-rank">
                        {String(candidate.rank).padStart(2, "0")}
                      </span>
                      <span className="intel-person">
                        <strong>{candidate.name}</strong>
                        <small>{candidate.resumeFilename}</small>
                      </span>
                      <span className="intel-candidate-signals">
                        <small>EVIDENCED</small>
                        {candidate.matchedSkills.slice(0, 3).join(" · ") || "—"}
                      </span>
                      <span
                        className="intel-candidate-signals is-missing"
                        title="No supporting resume evidence was found; absence of evidence is not proof that a candidate lacks the skill."
                      >
                        <small>NOT EVIDENCED</small>
                        {candidate.missingSkills.slice(0, 2).join(" · ") ||
                          "None recorded"}
                      </span>
                      <b>{candidate.finalScore.toFixed(1)}</b>
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="saas-empty">
                <span className="saas-eyebrow">NO MATCHES</span>
                <h2>No candidates match those filters.</h2>
                <p>Try a different name, skill, or requirement.</p>
              </div>
            )}
          </section>
        )}

        {tab === "evidence" && (
          <section
            className="intel-evidence"
            aria-label="Indexed candidate evidence"
          >
            <div className="intel-view-heading">
              <div>
                <span className="app-meta-label">SOURCE RECORDS</span>
                <h2>Read the underlying evidence.</h2>
              </div>
              <p>Indexed resume excerpts stay linked to each candidate.</p>
            </div>
            {evidenceCandidate ? (
              <div className="intel-evidence-layout">
                <div className="intel-evidence-picker">
                  <span className="app-meta-label">CANDIDATES</span>
                  {analysis.candidates.map((candidate) => (
                    <button
                      aria-pressed={evidenceCandidate.id === candidate.id}
                      key={candidate.id}
                      onClick={() => setEvidenceCandidateId(candidate.id)}
                      type="button"
                    >
                      <span>{String(candidate.rank).padStart(2, "0")}</span>
                      <strong>{candidate.name}</strong>
                      <b>{candidate.finalScore.toFixed(1)}</b>
                    </button>
                  ))}
                </div>
                <div className="intel-evidence-detail">
                  <header>
                    <FileText size={18} aria-hidden="true" />
                    <div>
                      <span className="app-meta-label">
                        {evidenceCandidate.resumeFilename}
                      </span>
                      <h3>{evidenceCandidate.name}</h3>
                    </div>
                  </header>
                  <CandidateEvidence
                    analysisId={analysis.id}
                    candidateId={evidenceCandidate.id}
                    filename={evidenceCandidate.resumeFilename}
                    isSample={analysis.isSample}
                    key={evidenceCandidate.id}
                    sampleEvidence={evidenceCandidate.evidence}
                  />
                </div>
              </div>
            ) : (
              <div className="saas-empty">
                <h2>No evidence available.</h2>
                <p>No candidate documents are linked to this analysis.</p>
              </div>
            )}
          </section>
        )}

        {tab === "ask" && (
          <section
            className="intel-ask"
            aria-label="Ask Forma intelligence workspace"
          >
            <div className="intel-view-heading">
              <div>
                <span className="app-meta-label">
                  ANALYSIS-WIDE INTELLIGENCE
                </span>
                <h2>Ask Forma.</h2>
              </div>
              <p>
                Answers use indexed documents and stored scores from this
                analysis.
              </p>
            </div>
            {askReady ? (
              <AskFormaWorkspace
                analysisId={analysis.id}
                onSourceSelect={(source, trigger) => {
                  const candidate = analysis.candidates.find(
                    (c) => c.id === source.candidateId,
                  );
                  if (candidate) {
                    triggerRef.current = trigger;
                    setCitation(source);
                    setSelected(candidate);
                  }
                }}
              />
            ) : (
              <div className="saas-empty">
                <span className="saas-eyebrow">NOT AVAILABLE YET</span>
                <h2>Questions open after indexing.</h2>
                <p>
                  {analysis.isSample
                    ? "Ask Forma. is available for completed, indexed analyses in a connected workspace."
                    : "This analysis does not have indexed document evidence yet."}
                </p>
              </div>
            )}
          </section>
        )}
      </motion.div>

      {compareError && (
        <p role="status" className="comparison-feedback">
          {compareError}
        </p>
      )}
      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.aside
            className="compare-tray"
            aria-label="Candidate comparison selection"
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
            transition={{ duration: 0.18 }}
          >
            <span>COMPARE / {String(compareIds.length).padStart(2, "0")}</span>
            <div className="compare-tray-names">
              {compareIds.map((id) => (
                <button
                  type="button"
                  key={id}
                  aria-label={`Remove ${analysis.candidates.find((c) => c.id === id)?.name} from comparison`}
                  onClick={() => toggleCompare(id)}
                >
                  {analysis.candidates.find((c) => c.id === id)?.name} ×
                </button>
              ))}
            </div>
            {compareIds.length < 2 ? (
              <small>Select one more candidate</small>
            ) : (
              <Link
                href={`/app/analyses/${analysis.id}/compare?candidates=${compareIds.join(",")}`}
              >
                Compare candidates →
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setCompareIds([]);
                setCompareError("");
              }}
            >
              Clear all
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      <CandidateDrawer
        key={`${selected?.id}:${citation?.sourceId}`}
        analysisId={analysis.id}
        candidate={selected}
        isSample={analysis.isSample}
        onClose={() => setSelected(null)}
        returnFocusRef={triggerRef}
        totalCandidates={analysis.candidates.length}
        citation={citation}
        initialSource={
          citation
            ? {
                documentId: citation.documentId,
                chunkIndex: citation.chunkIndex,
              }
            : undefined
        }
      />
    </main>
  );
}
