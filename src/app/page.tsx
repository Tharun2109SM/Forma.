import Link from "next/link";
import { ArrowRight, Check, CornerDownRight } from "lucide-react";
import { MarketingMotion } from "@/components/marketing/marketing-motion";
import { ThemeToggle } from "@/components/theme-toggle";

const sourceFragments = [
  { label: "resume_12.pdf", kind: ".PDF" },
  { label: "ReactJS", kind: "SKILL" },
  { label: "Node.js", kind: "SKILL" },
  { label: "Built REST APIs", kind: "EVIDENCE" },
  { label: "PostgreSQL", kind: "SKILL" },
];

const rankings = [
  { rank: "01", name: "Arjun Sharma", score: "92.4", active: true },
  { rank: "02", name: "Maya Reddy", score: "88.6", active: false },
  { rank: "03", name: "Rohan Shah", score: "85.2", active: false },
];

export default function Home() {
  return (
    <main className="marketing-shell">
      <MarketingMotion />
      <header className="public-nav">
        <Link className="wordmark" href="/" aria-label="Forma home">
          Forma<span>.</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#method">Method</a>
          <a href="#product">Product</a>
        </nav>
        <div className="nav-actions">
          <ThemeToggle compact />
          <Link className="text-link" href="/login">
            Sign in
          </Link>
          <Link className="button button-dark button-small" href="/signup">
            Get started <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
        </div>
      </header>

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-rule" aria-hidden="true" data-hero-reveal>
          <span>FORMA / 001</span>
          <span>CANDIDATE INTELLIGENCE</span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow" data-hero-reveal>Explainable shortlisting</p>
          <h1 id="hero-title" data-hero-reveal>
            Find the signal
            <span>in every application.</span>
          </h1>
          <div className="hero-support" data-hero-reveal>
            <p>
              Rank every candidate using semantic relevance and explicit skill
              alignment—with evidence behind every result.
            </p>
            <div className="hero-actions">
              <Link className="button button-signal" href="/signup">
                Start shortlisting <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
              <a className="button button-quiet" href="#method">
                See the method
              </a>
            </div>
          </div>
        </div>

        <div className="signal-stage" id="product" data-hero-reveal>
          <div className="stage-header">
            <div>
              <span className="status-dot" />
              <span>ANALYSIS / FRONTEND ENGINEER</span>
            </div>
            <span>ILLUSTRATIVE DATA / 8 APPLICATIONS</span>
          </div>

          <div className="stage-grid">
            <div className="stage-column source-column">
              <div className="column-label">
                <span>01</span>
                <span>UNSTRUCTURED</span>
              </div>
              <div className="fragment-field">
                {sourceFragments.map((fragment, index) => (
                  <div
                    className={`source-fragment fragment-${index + 1}`}
                    key={fragment.label}
                  >
                    <span>{fragment.kind}</span>
                    <strong>{fragment.label}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="stage-column engine-column">
              <div className="column-label">
                <span>02</span>
                <span>STRUCTURED SIGNALS</span>
              </div>
              <div className="signal-engine">
                <div className="normalization-row">
                  <span>React.js</span>
                  <CornerDownRight size={15} />
                  <strong>REACT</strong>
                </div>
                <div className="normalization-row">
                  <span>Node / NodeJS</span>
                  <CornerDownRight size={15} />
                  <strong>NODE.JS</strong>
                </div>
                <div className="score-signals">
                  <div>
                    <span>SEM</span>
                    <strong>94</strong>
                    <i style={{ "--value": "94%" } as React.CSSProperties} />
                  </div>
                  <div>
                    <span>KEY</span>
                    <strong>91</strong>
                    <i style={{ "--value": "91%" } as React.CSSProperties} />
                  </div>
                  <div>
                    <span>REQ</span>
                    <strong>93</strong>
                    <i style={{ "--value": "93%" } as React.CSSProperties} />
                  </div>
                </div>
              </div>
            </div>

            <div className="stage-column rank-column">
              <div className="column-label">
                <span>03</span>
                <span>EXPLAINABLE RANK</span>
              </div>
              <div className="ranking-stack">
                {rankings.map((candidate) => (
                  <div
                    className={`ranking-row ${candidate.active ? "is-active" : ""}`}
                    key={candidate.rank}
                  >
                    <span className="rank-number">{candidate.rank}</span>
                    <span className="candidate-name">{candidate.name}</span>
                    <span className="candidate-score">{candidate.score}</span>
                  </div>
                ))}
                <p>Every score resolves to visible signals and source evidence.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="method-section" id="method" aria-label="Forma method">
        <div className="section-index" data-scroll-reveal>
          <span>METHOD / 002</span>
          <p>Two independent signals. One deterministic rank.</p>
        </div>
        <div className="method-grid" data-scroll-reveal>
          <article>
            <span className="method-code">SEM</span>
            <h2>Meaning, not phrasing.</h2>
            <p>
              Semantic alignment finds relevant experience even when a resume
              uses different words from the role.
            </p>
          </article>
          <article>
            <span className="method-code">KEY</span>
            <h2>Explicit skills, verified.</h2>
            <p>
              Required technologies and qualifications are matched directly,
              including normalized aliases.
            </p>
          </article>
          <article>
            <span className="method-code">RANK</span>
            <h2>A score you can defend.</h2>
            <p>
              Independent signals combine through fixed weights, then every
              candidate is ranked strongest to weakest.
            </p>
          </article>
        </div>
      </section>

      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="section-index" data-scroll-reveal>
          <span>WORKFLOW / 003</span>
          <p id="workflow-title">From one role to a defensible shortlist.</p>
        </div>
        <ol className="workflow-track" data-scroll-reveal>
          <li>
            <span>01</span>
            <strong>Define the role</strong>
            <p>Upload one job description as the shared reference.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Add candidates</strong>
            <p>Bring every resume into one consistent comparison.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Resolve signals</strong>
            <p>Measure meaning and explicit skills independently.</p>
          </li>
          <li>
            <span>04</span>
            <strong>Review the rank</strong>
            <p>See every candidate, score, match, and required gap.</p>
          </li>
        </ol>
      </section>

      <section className="product-preview-section" aria-labelledby="preview-title">
        <div className="preview-copy" data-scroll-reveal>
          <span>PRODUCT / 004</span>
          <h2 id="preview-title">A shortlist that shows its work.</h2>
          <p>
            Final scores remain traceable to independent signals—so recruiters can
            decide with context, not a black box.
          </p>
          <Link className="button button-quiet" href="/signup">
            Explore sample workspace <ArrowRight size={15} />
          </Link>
        </div>
        <div className="landing-app-preview" data-scroll-reveal>
          <div className="preview-app-bar">
            <span>Forma. / Analysis</span>
            <span>SAMPLE / COMPLETED</span>
          </div>
          <div className="preview-app-heading">
            <div>
              <span>FRONTEND ENGINEER</span>
              <strong>8 candidates</strong>
            </div>
            <span>SEM × KEY × REQ</span>
          </div>
          {[92.4, 88.6, 85.2].map((score, index) => (
            <div className="preview-candidate" key={score}>
              <span>0{index + 1}</span>
              <div>
                <strong>{["Arjun Sharma", "Maya Reddy", "Rohan Shah"][index]}</strong>
                <small>
                  <Check size={10} /> React&nbsp;&nbsp; <Check size={10} /> TypeScript
                </small>
              </div>
              <div className="preview-signals">
                <span>SEM {[94, 91, 88][index]}</span>
                <span>KEY {[92, 87, 82][index]}</span>
              </div>
              <strong>{score.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta" data-scroll-reveal>
        <span>READY / 005</span>
        <h2>Ready to find the signal?</h2>
        <p>Build an explainable candidate shortlist from your next role.</p>
        <Link className="button button-signal" href="/signup">
          Start shortlisting <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="marketing-footer">
        <Link className="wordmark" href="/">
          Forma<span>.</span>
        </Link>
        <p>Candidate Intelligence</p>
        <div>
          <a href="#method">Method</a>
          <a href="#product">Product</a>
          <Link href="/login">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
