import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileText, MessageSquareText } from "lucide-react";
import {
  MarketingCTA,
  MarketingPageIntro,
  MarketingSectionHeading,
} from "@/components/marketing/marketing-shell";
import { MonoEyebrow, SignalLine } from "@/components/ui/forma-grid";

export const metadata: Metadata = {
  title: "Product",
  description: "Explore Forma.'s document intake, candidate intelligence, explainable ranking, evidence, and analysis-wide recruiter Q&A.",
};

const intake = ["Job description", "Candidate PDF", "Candidate DOCX", "Candidate XML", "Candidate TXT"];
const signals = [
  { code: "01", title: "Extract", detail: "Parse each file with its format-aware path. Scanned PDFs can use OCR fallback." },
  { code: "02", title: "Normalize", detail: "Resolve skill aliases and requirements into a common comparison language." },
  { code: "03", title: "Measure", detail: "Read semantic relevance, explicit matches, and required-skill coverage separately." },
  { code: "04", title: "Rank", detail: "Combine stored signals through fixed weights and a repeatable ordering rule." },
];

export default function ProductPage() {
  return (
    <main className="marketing-detail-page marketing-product-page">
      <MarketingPageIntro
        index="01"
        eyebrow="PRODUCT"
        title={<>One workspace.<br /><em>Every candidate signal.</em></>}
        description="Forma. turns a role and its candidate documents into a ranked, inspectable shortlist. Each result keeps its signals and source evidence within reach."
        aside={<Link className="marketing-inline-link" href="/signup">Start an analysis <ArrowUpRight size={15} aria-hidden="true" /></Link>}
      />

      <section className="marketing-detail-section" aria-labelledby="product-flow-title">
        <MarketingSectionHeading index="01" label="DOCUMENT TO DECISION" title={<span id="product-flow-title">The system, end to end.</span>} description="The same stages visible in the product are the stages behind the result." />
        <div className="marketing-product-map">
          <div className="marketing-product-inputs">
            <MonoEyebrow>INPUT / SOURCE DOCUMENTS</MonoEyebrow>
            {intake.map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><FileText size={15} aria-hidden="true" /><strong>{item}</strong></div>
            ))}
            <small>PDF · DOCX · XML · TXT</small>
          </div>
          <div className="marketing-product-stages">
            <MonoEyebrow>PROCESS / INTELLIGENCE PIPELINE</MonoEyebrow>
            {signals.map((signal) => (
              <div key={signal.code}>
                <span>{signal.code}</span>
                <div><strong>{signal.title}</strong><p>{signal.detail}</p></div>
                <SignalLine active={signal.code === "04"} />
              </div>
            ))}
          </div>
          <div className="marketing-product-outputs">
            <MonoEyebrow>OUTPUT / RECRUITER WORKSPACE</MonoEyebrow>
            <div><span>01</span><strong>Ranked shortlist</strong><small>fixed-weight score</small></div>
            <div><span>02</span><strong>Candidate detail</strong><small>matched + missing skills</small></div>
            <div><span>03</span><strong>Evidence</strong><small>source text and explanation</small></div>
            <div><span>04</span><strong>Ask Forma.</strong><small>analysis-scoped Q&amp;A</small></div>
          </div>
        </div>
      </section>

      <section className="marketing-detail-section marketing-split-section" aria-labelledby="intelligence-title">
        <MarketingSectionHeading index="02" label="CANDIDATE INTELLIGENCE" title={<span id="intelligence-title">A shortlist that shows its work.</span>} description="Move from ranked overview to the exact reason for a candidate's position." />
        <div className="marketing-feature-rows">
          <article><span>SEM / 50%</span><div><h3>Meaning across phrasing</h3><p>Embeddings compare the role and resume content for semantic alignment.</p></div></article>
          <article><span>EXP / 30%</span><div><h3>Explicit requirements</h3><p>Normalized skill terms make direct matches and omissions visible.</p></div></article>
          <article><span>COV / 20%</span><div><h3>Required coverage</h3><p>Required skills are measured as their own signal before final ranking.</p></div></article>
          <article><span>RANK / FIXED</span><div><h3>Deterministic order</h3><p>Stored scores are combined by code, with repeatable tie breaking.</p></div></article>
        </div>
      </section>

      <section className="marketing-detail-section marketing-evidence-section" aria-labelledby="evidence-title">
        <MarketingSectionHeading index="03" label="EVIDENCE" title={<span id="evidence-title">Stay close to the source.</span>} description="Candidate detail keeps score composition, matched skills, missing requirements, and excerpts together." />
        <div className="marketing-evidence-diagram">
          <div><span>RANK / 01</span><strong>Final score</strong><p>Semantic + explicit + coverage</p></div>
          <SignalLine active />
          <div><span>OPEN / CANDIDATE</span><strong>Why this position?</strong><p>Signal breakdown and requirement gaps</p></div>
          <SignalLine active />
          <div><span>TRACE / SOURCE</span><strong>Document evidence</strong><p>Resume excerpts alongside the explanation</p></div>
        </div>
      </section>

      <section className="marketing-detail-section marketing-ask-section" aria-labelledby="ask-title">
        <div className="marketing-ask-copy">
          <MarketingSectionHeading index="04" label="ASK FORMA." title={<span id="ask-title">Questions belong inside the analysis.</span>} description="Ask Forma. retrieves from the current role and its indexed candidate documents, then shows the sources behind its answer." />
          <Link className="marketing-inline-link" href="/method">Explore the method <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="marketing-ask-visual" aria-label="Ask Forma workflow illustration">
          <div><MessageSquareText size={17} aria-hidden="true" /><span>RECRUITER QUESTION</span><strong>Compare candidates against a requirement.</strong></div>
          <div><span>RETRIEVAL</span><strong>Current analysis only</strong><small>role + candidate document chunks</small></div>
          <div><span>ANSWER</span><strong>Grounded explanation</strong><small>source references remain visible</small></div>
        </div>
      </section>

      <MarketingCTA title="Make the shortlist inspectable." description="Upload one role and the candidate documents you want to compare. Follow every score back to its signals." />
    </main>
  );
}
