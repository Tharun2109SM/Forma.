import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingMotion } from "@/components/marketing/marketing-motion";
import {
  AskFormaSection,
  ExtractionSection,
  InputSection,
  ProductPreview,
  RankingSection,
  SignalSystem,
} from "@/components/marketing/marketing-sections";
import { CoordinateMarker, MonoEyebrow, SectionRule } from "@/components/ui/forma-grid";

export default function Home() {
  return (
    <main className="marketing-home">
      <MarketingMotion />

      <section className="hero-section hero-redesign" aria-labelledby="hero-title">
        <CoordinateMarker className="hero-coordinate">X:01 / Y:01</CoordinateMarker>
        <div className="hero-copy">
          <div className="hero-primary">
            <MonoEyebrow>FORMA / CANDIDATE INTELLIGENCE</MonoEyebrow>
            <h1 id="hero-title" data-hero-line>
              Find the signal
              <span>in every application.</span>
            </h1>
          </div>
          <div className="hero-support" data-hero-support>
            <p>
              Turn resume noise into a defensible shortlist. Forma. aligns every
              profile to the role, ranks it through fixed weights, and leaves the
              evidence visible.
            </p>
            <div className="hero-actions">
              <Link className="button button-signal" href="/signup">
                Start shortlisting <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
              <Link className="button button-quiet" href="/method">See the method</Link>
            </div>
            <small>SAMPLE VISUALIZATION · NOT LIVE CANDIDATE DATA</small>
          </div>
        </div>
        <SectionRule tone="standard" />
        <SignalSystem />
      </section>

      <div className="continuous-story-rail" aria-hidden="true"><i /></div>
      <InputSection />
      <ExtractionSection />
      <RankingSection />
      <ProductPreview />
      <AskFormaSection />

      <section className="final-cta" data-scroll-reveal>
        <CoordinateMarker>Y:07 / READY</CoordinateMarker>
        <h2>Structure the next decision.</h2>
        <p>Build an explainable shortlist from one role and every candidate document.</p>
        <Link className="button button-signal" href="/signup">
          Start shortlisting <ArrowRight size={16} />
        </Link>
      </section>

    </main>
  );
}
