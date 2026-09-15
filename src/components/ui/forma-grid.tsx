import type { CSSProperties, ReactNode } from "react";

type GridTone = "quiet" | "standard" | "signal" | "error";

export function FormaGrid({
  className = "",
  columns = 12,
  rows = 8,
}: {
  className?: string;
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`forma-grid ${className}`.trim()}
      style={{ "--forma-grid-columns": columns, "--forma-grid-rows": rows } as CSSProperties}
    >
      <span className="forma-grid-columns" />
      <span className="forma-grid-rows" />
      <i className="forma-grid-node forma-grid-node-a" />
      <i className="forma-grid-node forma-grid-node-b" />
    </div>
  );
}

export function MonoEyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`mono-eyebrow ${className}`.trim()}>{children}</span>;
}

export function CoordinateMarker({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`coordinate-marker ${className}`.trim()}>{children}</span>;
}

export function SectionRule({
  tone = "quiet",
  className = "",
}: {
  tone?: GridTone;
  className?: string;
}) {
  return <span aria-hidden="true" className={`section-rule is-${tone} ${className}`.trim()} />;
}

export function SignalLine({
  active = false,
  className = "",
  children,
}: {
  active?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={`signal-line ${active ? "is-active" : ""} ${className}`.trim()}
    >
      <i />
      {children}
    </span>
  );
}

export function GridPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid-page ${className}`.trim()}>
      <FormaGrid />
      <div className="grid-page-content">{children}</div>
    </div>
  );
}
