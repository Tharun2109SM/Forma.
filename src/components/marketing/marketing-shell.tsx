import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CoordinateMarker, MonoEyebrow } from "@/components/ui/forma-grid";

const links = [
  { href: "/product", label: "Product" },
  { href: "/method", label: "Method" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingNav() {
  return (
    <header className="public-nav marketing-site-nav">
      <Link className="wordmark" href="/" aria-label="Forma home">
        Forma<span>.</span>
      </Link>
      <nav className="nav-links" aria-label="Public navigation">
        {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
      </nav>
      <div className="nav-actions">
        <ThemeToggle compact />
        <Link className="text-link" href="/login">Sign in</Link>
        <Link className="button button-dark button-small" href="/signup">
          Start analysis <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <details className="marketing-mobile-nav">
          <summary aria-label="Open public navigation"><Menu size={20} aria-hidden="true" /></summary>
          <nav aria-label="Mobile public navigation">
            {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
            <Link href="/login">Sign in</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer marketing-site-footer">
      <div className="marketing-site-footer-primary">
        <Link className="wordmark" href="/" aria-label="Forma home">Forma<span>.</span></Link>
        <p>Candidate intelligence built on evidence.</p>
      </div>
      <nav aria-label="Footer navigation">
        {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
        <Link href="/login">Sign in</Link>
      </nav>
      <span className="marketing-site-footer-note">AI EXPLAINS THE RESULT. THE RANKING REMAINS DETERMINISTIC.</span>
    </footer>
  );
}

export function MarketingPageIntro({
  index,
  eyebrow,
  title,
  description,
  aside,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="marketing-page-intro">
      <CoordinateMarker>Y:{index} / {eyebrow}</CoordinateMarker>
      <div className="marketing-page-intro-grid">
        <div>
          <MonoEyebrow>FORMA / {eyebrow}</MonoEyebrow>
          <h1>{title}</h1>
        </div>
        <div className="marketing-page-intro-aside">
          <p>{description}</p>
          {aside}
        </div>
      </div>
    </header>
  );
}

export function MarketingSectionHeading({
  index,
  label,
  title,
  description,
}: {
  index: string;
  label: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <div className="marketing-section-heading">
      <span className="marketing-section-index">{index} / {label}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function MarketingCTA({
  eyebrow = "NEXT / START",
  title = "Build your first evidence-backed shortlist.",
  description = "Start with a job description and candidate documents. Forma. handles the structure, signals, and explanation.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className="marketing-site-cta">
      <MonoEyebrow>{eyebrow}</MonoEyebrow>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button button-signal" href="/signup">Start analysis <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}
