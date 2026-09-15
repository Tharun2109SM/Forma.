import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import {
  MarketingCTA,
  MarketingPageIntro,
  MarketingSectionHeading,
} from "@/components/marketing/marketing-shell";
import { MonoEyebrow } from "@/components/ui/forma-grid";

export const metadata: Metadata = {
  title: "Security",
  description: "How Forma. scopes document uploads, storage, authentication, analysis access, and recruiter Q&A.",
};

const boundaries = [
  { code: "01", label: "ACCOUNT", title: "Authenticated access", detail: "The application requires a signed-in account before a recruiter can view their workspace or analyses." },
  { code: "02", label: "UPLOAD", title: "Scoped file transfer", detail: "The server generates short-lived upload URLs and user/analysis-specific object keys for direct uploads to R2." },
  { code: "03", label: "DATA", title: "Row-level boundaries", detail: "Supabase row-level security and user-scoped queries restrict access to analysis and document records." },
  { code: "04", label: "INTELLIGENCE", title: "Analysis-scoped retrieval", detail: "Ask Forma. checks analysis ownership before retrieving document evidence for an answer." },
];

export default function SecurityPage() {
  return (
    <main className="marketing-detail-page marketing-security-page">
      <MarketingPageIntro
        index="03"
        eyebrow="SECURITY"
        title={<>Clear boundaries.<br /><em>Evidence stays in scope.</em></>}
        description="Recruiting documents deserve deliberate access boundaries. Forma. separates file storage, application records, and AI retrieval by user and analysis."
        aside={<Link className="marketing-inline-link" href="/method">Understand the method <ArrowRight size={15} aria-hidden="true" /></Link>}
      />

      <section className="marketing-detail-section" aria-labelledby="security-boundaries-title">
        <MarketingSectionHeading index="01" label="ACCESS MODEL" title={<span id="security-boundaries-title">A boundary at every layer.</span>} description="These controls describe the product's current implementation, from upload to answer." />
        <div className="marketing-security-boundaries">
          {boundaries.map((boundary) => (
            <article key={boundary.code}>
              <span>{boundary.code} / {boundary.label}</span>
              <LockKeyhole size={17} strokeWidth={1.7} aria-hidden="true" />
              <h3>{boundary.title}</h3>
              <p>{boundary.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-detail-section marketing-split-section" aria-labelledby="security-flow-title">
        <MarketingSectionHeading index="02" label="DOCUMENT PATH" title={<span id="security-flow-title">Your source files follow a defined path.</span>} description="The browser sends files directly to private object storage using server-issued upload URLs. The app stores processing state and indexed evidence separately." />
        <div className="marketing-security-flow">
          <div><span>01 / BROWSER</span><strong>Choose documents</strong><small>PDF · DOCX · XML · TXT</small></div>
          <div><span>02 / API</span><strong>Request upload URLs</strong><small>authenticated, short-lived</small></div>
          <div><span>03 / R2</span><strong>Store source files</strong><small>user + analysis object path</small></div>
          <div><span>04 / DATA</span><strong>Process and index</strong><small>user-owned analysis records</small></div>
        </div>
      </section>

      <section className="marketing-detail-section marketing-security-note" aria-labelledby="security-honesty-title">
        <div>
          <MonoEyebrow>SECURITY / PRODUCT PRINCIPLE</MonoEyebrow>
          <h2 id="security-honesty-title">Security begins with scope.</h2>
        </div>
        <p>Source files, application records, and retrieved evidence each stay tied to the authenticated account and the active analysis. The controls above describe the boundaries built into Forma. today.</p>
      </section>

      <MarketingCTA eyebrow="NEXT / START SECURELY" title="Start with a controlled analysis." description="Create a role-specific workspace, upload the documents you choose, and inspect the evidence behind each result." />
    </main>
  );
}
