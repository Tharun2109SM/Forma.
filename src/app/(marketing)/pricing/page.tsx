import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageIntro, MarketingSectionHeading } from "@/components/marketing/marketing-shell";
import { MonoEyebrow } from "@/components/ui/forma-grid";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Forma. pricing is being prepared. Explore the product and start an analysis today.",
};

export default function PricingPage() {
  return (
    <main className="marketing-detail-page marketing-pricing-page">
      <MarketingPageIntro
        index="04"
        eyebrow="PRICING"
        title={<>Built for a clearer<br /><em>hiring workflow.</em></>}
        description="Forma. is preparing its pricing model. Plan names, limits, and paid features are not published yet. You can still explore how the product works."
      />

      <section className="marketing-pricing-state" aria-labelledby="pricing-state-title">
        <div className="marketing-pricing-state-heading">
          <MonoEyebrow>COMMERCIAL STATUS / IN PREPARATION</MonoEyebrow>
          <h2 id="pricing-state-title">Pricing coming soon.</h2>
          <p>Plan details and limits will be published here when they are finalized. Until then, explore the current product experience.</p>
        </div>
        <div className="marketing-pricing-actions">
          <Link className="button button-signal" href="/signup">Start an analysis <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="button button-quiet" href="/product">Explore the product</Link>
        </div>
      </section>

      <section className="marketing-detail-section marketing-split-section" aria-labelledby="pricing-capabilities-title">
        <MarketingSectionHeading index="01" label="WHAT FORMA. DOES" title={<span id="pricing-capabilities-title">The value is already concrete.</span>} description="Explore the product's current workflow while commercial plans are being defined." />
        <div className="marketing-feature-rows">
          <article><span>01 / INPUT</span><div><h3>Multi-format document intake</h3><p>Compare a job description with candidate PDF, DOCX, XML, and TXT files.</p></div></article>
          <article><span>02 / RANK</span><div><h3>Explainable shortlist</h3><p>See fixed-weight semantic, explicit, and coverage scores together.</p></div></article>
          <article><span>03 / DETAIL</span><div><h3>Candidate evidence</h3><p>Review matched skills, missing requirements, and source excerpts.</p></div></article>
          <article><span>04 / ASK</span><div><h3>Analysis-wide questions</h3><p>Ask Forma. about the role and its candidates with source references.</p></div></article>
        </div>
      </section>

      <div className="marketing-pricing-footer-note"><span>FORMA / PRICING</span><p>Plan availability and terms will be published here when they are ready.</p></div>
    </main>
  );
}
