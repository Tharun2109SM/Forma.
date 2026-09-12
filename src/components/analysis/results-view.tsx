"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { useRef, useState } from "react";
import type { AnalysisWorkspaceData } from "@/lib/data/analysis";
import type { CandidateResult } from "@/lib/data/demo-candidates";
import { CandidateDrawer } from "@/components/analysis/candidate-drawer";
import { ScoreValue } from "@/components/analysis/score-value";
import { StatusBadge } from "@/components/dashboard/status-badge";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function ResultsView({ analysis }: { analysis: AnalysisWorkspaceData }) {
  const [selected, setSelected] = useState<CandidateResult | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <main className="workspace-page results-page">
      <Link className="back-link" href="/dashboard">
        <ArrowLeft size={15} strokeWidth={1.8} /> Shortlists
      </Link>

      <header className="results-header">
        <div>
          <span className="page-kicker">ANALYSIS / {analysis.id.slice(0, 8).toUpperCase()}</span>
          <h1>{analysis.title}</h1>
          <p>
            {[analysis.jobTitle, analysis.companyName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="results-meta">
          <StatusBadge status="COMPLETED" />
          <span>{analysis.candidateCount} candidates</span>
          <span>{dateFormatter.format(new Date(analysis.createdAt))}</span>
        </div>
      </header>

      {analysis.isSample && (
        <div className="preview-disclosure" role="note">
          <span>SAMPLE RESULTS</span>
          <p>
            This preview demonstrates the result experience. Scores shown here were not produced by a live analysis.
          </p>
        </div>
      )}

      {analysis.candidates.length === 0 ? (
        <section className="empty-results">
          <span className="app-meta-label">NO RANKED CANDIDATES</span>
          <h2>This analysis has no completed results.</h2>
          <p>Return to the role setup and add at least one valid resume.</p>
          <Link className="primary-action" href="/analysis/new">
            New analysis
          </Link>
        </section>
      ) : (
        <section className="ranking-panel" aria-labelledby="ranking-title">
          <div className="ranking-panel-title">
            <div>
              <span className="app-meta-label">RANKING / ALL CANDIDATES</span>
              <h2 id="ranking-title">Strongest alignment first</h2>
            </div>
            <p>
              Final = <b>50%</b> semantic + <b>30%</b> explicit skills + <b>20%</b> coverage
            </p>
          </div>
          <div className="result-grid result-grid-head" aria-hidden="true">
            <span>Rank</span>
            <span>Candidate</span>
            <span>Matched skills</span>
            <span>Semantic</span>
            <span>Keyword</span>
            <span>Final score</span>
            <span />
          </div>
          <div className="candidate-list">
            {analysis.candidates.map((candidate) => (
              <button
                aria-label={`Open details for ${candidate.name}, ranked ${candidate.rank}`}
                className={`result-grid candidate-result-row ${candidate.rank <= 3 ? "is-top-three" : ""}`}
                key={candidate.id}
                onClick={(event) => {
                  drawerTriggerRef.current = event.currentTarget;
                  setSelected(candidate);
                }}
                type="button"
              >
                <span className="result-rank">
                  {String(candidate.rank).padStart(2, "0")}
                  {candidate.rank <= 3 && <i aria-hidden="true" />}
                </span>
                <span className="result-candidate">
                  <strong>{candidate.name}</strong>
                  <small>{candidate.resumeFilename}</small>
                </span>
                <span className="result-skills">
                  {candidate.matchedSkills.slice(0, 3).map((skill) => (
                    <i key={skill}>
                      <Check aria-hidden="true" size={10} /> {skill}
                    </i>
                  ))}
                  {candidate.matchedSkills.length > 3 && (
                    <small>+{candidate.matchedSkills.length - 3}</small>
                  )}
                </span>
                <span className="result-signal" data-label="Semantic">
                  <i aria-hidden="true">
                    <b style={{ width: `${candidate.semanticScore}%` }} />
                  </i>
                  <strong>{candidate.semanticScore.toFixed(0)}</strong>
                </span>
                <span className="result-signal" data-label="Keyword">
                  <i aria-hidden="true">
                    <b style={{ width: `${candidate.keywordScore}%` }} />
                  </i>
                  <strong>{candidate.keywordScore.toFixed(0)}</strong>
                </span>
                <span className="result-final" data-label="Final score">
                  <ScoreValue score={candidate.finalScore} />
                </span>
                <ArrowUpRight className="result-open" size={16} strokeWidth={1.7} />
              </button>
            ))}
          </div>
        </section>
      )}

      <CandidateDrawer
        candidate={selected}
        onClose={() => setSelected(null)}
        returnFocusRef={drawerTriggerRef}
        totalCandidates={analysis.candidates.length}
      />
    </main>
  );
}
