import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  MarketingCTA,
  MarketingPageIntro,
  MarketingSectionHeading,
} from "@/components/marketing/marketing-shell";
import { DEFAULT_WEIGHTS } from "@/lib/ranking/score";

export const metadata: Metadata = {
  title: "Method",
  description: "Understand Forma.'s format-aware extraction, normalized requirements, deterministic hybrid score, and evidence-grounded answers.",
};

const stages = [
  { code: "01", title: "Inputs", detail: "A job description and one or more candidate documents enter the analysis." },
  { code: "02", title: "Extraction", detail: "PDF, DOCX, XML, and TXT take format-aware extraction paths. OCR can recover scanned PDF text." },
  { code: "03", title: "Normalization", detail: "Skill aliases and role requirements are structured for a consistent comparison." },
  { code: "04", title: "Signal measurement", detail: "Semantic alignment, explicit keyword matches, and required-skill coverage are calculated separately." },
  { code: "05", title: "Hybrid score", detail: "Fixed weights combine the three signal scores into a final value." },
  { code: "06", title: "Rank + explanation", detail: "Candidates are ordered deterministically. Explanations describe the resulting position." },
  { code: "07", title: "Evidence retrieval", detail: "Ask Forma. retrieves indexed evidence from the current analysis for recruiter questions." },
];

const weights = [
  { code: "SEM", label: "Semantic alignment", value: DEFAULT_WEIGHTS.semantic, description: "How closely the candidate's experience aligns with the role's meaning." },
  { code: "EXP", label: "Explicit match", value: DEFAULT_WEIGHTS.keyword, description: "Direct evidence of named technologies and requirements." },
  { code: "COV", label: "Required coverage", value: DEFAULT_WEIGHTS.skill, description: "How much of the role's required skill set is evidenced." },
];

export default function MethodPage() {
  return (
    <main className="marketing-detail-page marketing-method-page">
      <MarketingPageIntro
        index="02"
        eyebrow="METHOD"
        title={<>The ranking is a formula.<br /><em>The explanation is AI.</em></>}
        description="Forma. separates measurement from generation. Candidate order comes from fixed, inspectable signals; AI helps explain the evidence around that order."
        aside={<Link className="marketing-inline-link" href="/product">Explore the product <ArrowRight size={15} aria-hidden="true" /></Link>}
      />

      <section className="marketing-detail-section" aria-labelledby="method-formula-title">
        <MarketingSectionHeading index="01" label="SCORE COMPOSITION" title={<span id="method-formula-title">Three signals. One fixed score.</span>} description="The current default weights are read from Forma.'s scoring configuration." />
        <div className="marketing-method-formula">
          {weights.map((signal) => (
            <div key={signal.code}>
              <span>{signal.code} / {signal.label.toUpperCase()}</span>
              <strong>{Math.round(signal.value * 100)}<small>%</small></strong>
              <p>{signal.description}</p>
            </div>
          ))}
        </div>
        <div className="marketing-formula-line"><span>FINAL SCORE</span><strong>= {Math.round(DEFAULT_WEIGHTS.semantic * 100)}% semantic + {Math.round(DEFAULT_WEIGHTS.keyword * 100)}% explicit + {Math.round(DEFAULT_WEIGHTS.skill * 100)}% coverage</strong></div>
      </section>

      <section className="marketing-detail-section marketing-split-section" aria-labelledby="method-pipeline-title">
        <MarketingSectionHeading index="02" label="METHOD PIPELINE" title={<span id="method-pipeline-title">From file to reason.</span>} description="Each stage has a distinct job. The source document and measured components remain available after ranking." />
        <ol className="marketing-method-stages">
          {stages.map((stage) => (
            <li key={stage.code}><span>{stage.code}</span><h3>{stage.title}</h3><p>{stage.detail}</p></li>
          ))}
        </ol>
      </section>

      <section className="marketing-method-principle" aria-label="Forma ranking principle">
        <span>THE DECISION BOUNDARY</span>
        <p>AI explains the result.<br /><em>It does not decide the rank.</em></p>
        <div><span>MEASURE</span><i /><span>WEIGH</span><i /><span>ORDER</span><i /><span>EXPLAIN</span></div>
      </section>

      <section className="marketing-detail-section marketing-split-section" aria-labelledby="method-qa-title">
        <MarketingSectionHeading index="03" label="RETRIEVAL" title={<span id="method-qa-title">Answers stay inside the role.</span>} description="Ask Forma. retrieves document chunks from the active analysis and returns source references with its response." />
        <div className="marketing-feature-rows">
          <article><span>01 / SCOPE</span><div><h3>One analysis at a time</h3><p>Retrieval is bound to the analysis being viewed.</p></div></article>
          <article><span>02 / EVIDENCE</span><div><h3>Role and resume content</h3><p>Indexed chunks supply the answer&apos;s source material.</p></div></article>
          <article><span>03 / CONTEXT</span><div><h3>Stored ranking signals</h3><p>Answers can refer to the deterministic results already calculated.</p></div></article>
          <article><span>04 / TRACE</span><div><h3>Visible sources</h3><p>Source references and excerpts accompany the answer in the product.</p></div></article>
        </div>
      </section>

      <MarketingCTA eyebrow="NEXT / SEE IT WORK" title="Make every ranking easier to inspect." description="Run an analysis and read each candidate through the same measured signals and evidence path." />
    </main>
  );
}
