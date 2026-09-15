import { ArrowUpRight, Check, FileText, Search } from "lucide-react";
import { CoordinateMarker, MonoEyebrow, SectionRule, SignalLine } from "@/components/ui/forma-grid";

const documents = [
  ["01", "role_frontend.xml", "XML", "REFERENCE"],
  ["02", "priya_menon.pdf", "PDF", "READY"],
  ["03", "rohan_verma.docx", "DOCX", "READY"],
  ["04", "farhan_sheikh.txt", "TXT", "READY"],
];

const candidates = [
  { rank: "01", name: "Priya Menon", semantic: 94, explicit: 91, coverage: 93, final: "92.9" },
  { rank: "02", name: "Rohan Verma", semantic: 90, explicit: 87, coverage: 88, final: "88.6" },
  { rank: "03", name: "Farhan Sheikh", semantic: 88, explicit: 83, coverage: 84, final: "85.5" },
];

export function SignalSystem() {
  return (
    <div className="signal-system" data-signal-system>
      <div className="signal-system-head">
        <span><i /> LIVE SYSTEM / SAMPLE DATA</span>
        <span>08 DOCUMENTS · FRONTEND ENGINEER</span>
      </div>
      <div className="signal-system-grid">
        <section className="noise-field" aria-label="Unstructured sample documents">
          <MonoEyebrow>01 / UNSTRUCTURED</MonoEyebrow>
          <div className="noise-fragments">
            {["ReactJS", "Built REST APIs", "Node / NodeJS", "PostgreSQL", "5+ years"].map((item, index) => (
              <span className={`noise-fragment noise-fragment-${index + 1}`} key={item}>
                <small>{index % 2 ? "EVIDENCE" : "TERM"}</small>{item}
              </span>
            ))}
          </div>
        </section>
        <section className="structure-field" aria-label="Structured profile signals">
          <MonoEyebrow>02 / STRUCTURED SIGNAL</MonoEyebrow>
          <div className="structured-terms">
            {['REACT', 'NODE.JS', 'POSTGRESQL', 'REST'].map((term, index) => (
              <span data-lock-term key={term}><i>{String(index + 1).padStart(2, '0')}</i>{term}<Check size={11} /></span>
            ))}
          </div>
          <div className="measurement-cluster">
            {[["SEMANTIC", "0.94", "94%"], ["EXPLICIT", "0.91", "91%"], ["COVERAGE", "0.93", "93%"]].map(([label, value, width]) => (
              <div key={label}><span>{label}</span><i><b style={{ "--score-width": width } as React.CSSProperties} /></i><strong>{value}</strong></div>
            ))}
          </div>
        </section>
        <section className="rank-field" aria-label="Illustrative ranked candidates">
          <MonoEyebrow>03 / EXPLAINABLE RANK</MonoEyebrow>
          <div className="hero-ranking">
            {candidates.map((candidate) => (
              <div className={candidate.rank === "01" ? "is-first" : ""} data-rank-row key={candidate.rank}>
                <span>{candidate.rank}</span><strong>{candidate.name}</strong><b>{candidate.final}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function InputSection() {
  return (
    <section className="story-section input-story" id="method" data-story-section>
      <div className="story-heading">
        <CoordinateMarker>Y:02 / INPUT</CoordinateMarker>
        <h2>One role.<br />Every candidate.</h2>
        <p>Files arrive as different formats and uneven language. Forma. keeps each source intact while giving the comparison one structure.</p>
      </div>
      <div className="document-index" data-scroll-reveal>
        <div className="document-index-head"><span>INDEX</span><span>DOCUMENT</span><span>FORMAT</span><span>STATE</span></div>
        {documents.map(([index, name, format, state]) => (
          <div className="document-index-row" key={name}>
            <span>{index}</span><strong><FileText size={14} /> {name}</strong><span>{format}</span><span>{state}</span>
          </div>
        ))}
      </div>
      <SignalLine active className="story-rail"><small>INGESTED / 04</small></SignalLine>
    </section>
  );
}

export function ExtractionSection() {
  const steps = [
    ["01", "PDF", "Native parser / OCR fallback"],
    ["02", "DOCX", "Paragraphs + tables"],
    ["03", "XML", "Safe structured extraction"],
    ["04", "TXT", "UTF-8 normalization"],
  ];
  return (
    <section className="story-section extraction-story" data-story-section>
      <div className="story-heading">
        <CoordinateMarker>Y:03 / EXTRACTION</CoordinateMarker>
        <h2>Language resolves<br />into evidence.</h2>
        <p>Parsing is format-aware. OCR appears only when a scanned PDF needs it. The interface reports the real path—not invented progress.</p>
      </div>
      <div className="extraction-pipeline" data-scroll-reveal>
        {steps.map(([index, label, copy]) => (
          <div className="pipeline-record" key={label}>
            <span>{index}</span><strong>{label}</strong><SignalLine active={index === "02"} /><p>{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RankingSection() {
  return (
    <section className="story-section ranking-story" data-story-section>
      <div className="story-heading">
        <CoordinateMarker>Y:04 / RANKING</CoordinateMarker>
        <h2>A score you can<br />take apart.</h2>
        <p>Three independent measures combine through fixed weights. The model explains the result; it never silently replaces the formula.</p>
      </div>
      <div className="formula-board" data-formula-board>
        <div className="formula-weights">
          {[["SEMANTIC", "50", "Meaning"], ["EXPLICIT", "30", "Resume evidence"], ["COVERAGE", "20", "Required evidence"]].map(([label, weight, copy]) => (
            <div data-formula-part key={label}><span>{label}</span><strong>{weight}<small>%</small></strong><p>{copy}</p></div>
          ))}
        </div>
        <div className="formula-statement"><SignalLine active /><strong>AI EXPLAINS THE RANKING.<br />IT DOES NOT DECIDE THE RANKING.</strong></div>
      </div>
    </section>
  );
}

export function ProductPreview() {
  return (
    <section className="product-story" id="product" data-story-section>
      <div className="product-story-copy">
        <CoordinateMarker>Y:05 / PRODUCT</CoordinateMarker>
        <h2>The shortlist<br />shows its work.</h2>
        <p>Activate a record to inspect evidenced signals, requirements not evidenced in the resume, score rails, and source evidence.</p>
      </div>
      <div className="product-console" data-scroll-reveal>
        <header><span>ANALYSIS / SAMPLE-001</span><span>COMPLETED · 03 CANDIDATES</span></header>
        <div className="product-console-head"><span>RANK</span><span>CANDIDATE</span><span>SEM</span><span>EXP</span><span>COV</span><span>FINAL</span></div>
        {candidates.map((candidate) => (
          <div className={candidate.rank === "01" ? "is-active" : ""} key={candidate.rank}>
            <span>{candidate.rank}</span><strong>{candidate.name}</strong><span>{candidate.semantic}</span><span>{candidate.explicit}</span><span>{candidate.coverage}</span><b>{candidate.final}</b><ArrowUpRight size={15} />
          </div>
        ))}
        <SectionRule tone="signal" />
        <footer><span>FINAL = 50% SEM + 30% EXP + 20% COV</span><span>SELECT RECORD →</span></footer>
      </div>
    </section>
  );
}

export function AskFormaSection() {
  return (
    <section className="story-section ask-story" data-story-section>
      <div className="story-heading">
        <CoordinateMarker>Y:06 / ASK FORMA.</CoordinateMarker>
        <h2>Ask the rank.<br />Follow the source.</h2>
        <p>Retrieval stays bounded to the role and indexed candidate documents. Every answer keeps its evidence path visible.</p>
      </div>
      <div className="retrieval-map" data-scroll-reveal>
        <div className="retrieval-question"><Search size={15} /><span>QUESTION / 01</span><strong>Why is Candidate 01 ranked above Candidate 02?</strong></div>
        <div className="retrieval-sources">
          {["Candidate 01 · Page 2", "Role · Requirements", "Candidate 02 · Page 1"].map((source, index) => (
            <div key={source}><span>0{index + 1}</span><SignalLine active={index !== 2} /><strong>{source}</strong></div>
          ))}
        </div>
        <div className="retrieval-answer"><span>FORMA. / GROUNDED ANSWER</span><p>Candidate 01 shows broader systems ownership and directly evidenced delivery across six product squads.</p><small>SOURCES / 02</small></div>
      </div>
    </section>
  );
}
