import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { EvidenceReference } from "@/lib/evidence/derive";
import type { FormaReport, ReportCandidate } from "./types";

const W = 595.28, H = 841.89, M = 44, CONTENT = W - M * 2, BOTTOM = H - 80;
const ink = rgb(.067, .067, .059), muted = rgb(.36, .36, .33), blue = rgb(.09, .36, 1);
const rule = rgb(.80, .79, .76), paper = rgb(.976, .973, .953);
export const EVIDENCE_DISCLAIMER = "Not evidenced indicates that Forma. found no supporting evidence for the requirement in the uploaded candidate documents. It does not necessarily mean the candidate does not possess that skill.";
const names = { shortlist: "SHORTLIST REPORT", ranking: "RANKING TABLE", "top-candidates": "TOP CANDIDATES REPORT", candidate: "CANDIDATE REPORT", comparison: "COMPARISON REPORT" };
type TextOptions = { size?: number; font?: PDFFont; color?: RGB; width?: number; x?: number; gap?: number };
type Column = { label: string; width: number; numeric?: boolean };

// Packaged, read-only font asset. All document generation stays in memory.
let fontBytes: Promise<Buffer> | undefined;
function reportFont() {
  fontBytes ??= readFile(path.join(process.cwd(), "src/lib/reports/fonts/Geist-Regular.ttf"));
  return fontBytes;
}
export function score(value: number | null, decimals = 1) {
  return value === null || !Number.isFinite(value) ? "N/A" : value.toFixed(decimals);
}
export function rank(value: number | null) { return value === null ? "N/A" : String(value).padStart(2, "0"); }

/** Measured wrapping, including unbroken filenames and unusually long names. */
export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const trial = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= width) { line = trial; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

class ReportCanvas {
  page!: PDFPage;
  y = 0;
  section = "";
  constructor(public doc: PDFDocument, public sans: PDFFont, public mono: PDFFont, public report: FormaReport) {}
  draw(text: string, x: number, top: number, size = 10, font = this.sans, color = ink) {
    // Suppress control codes, never alter substantive names/evidence.
    this.page.drawText(text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ""), { x, y: H - top - size, size, font, color });
  }
  line(top = this.y, color = rule, thickness = .6) {
    this.page.drawLine({ start: { x: M, y: H - top }, end: { x: W - M, y: H - top }, color, thickness });
  }
  newPage(section: string, continued = false) {
    this.section = section;
    this.page = this.doc.addPage([W, H]);
    this.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });
    this.draw("Forma", M, 32, 29);
    this.draw(".", M + this.sans.widthOfTextAtSize("Forma", 29), 32, 29, this.sans, blue);
    this.draw("CANDIDATE INTELLIGENCE", M, 68, 7.5, this.mono, muted);
    const label = names[this.report.type];
    this.draw(label, W - M - this.mono.widthOfTextAtSize(label, 8), 43, 8, this.mono, blue);
    this.line(90, ink, 1);
    this.y = 112;
    this.text(section + (continued ? " / continued" : ""), { size: 23, gap: 16 });
  }
  ensure(height: number) { if (this.y + height > BOTTOM) this.newPage(this.section, true); }
  text(text: string, options: TextOptions = {}) {
    const { size = 10, font = this.sans, color = ink, width = CONTENT, x = M, gap = 8 } = options;
    const lines = wrapText(text, font, size, width), lineHeight = size * 1.45;
    if (lines.length <= 5) this.ensure(lines.length * lineHeight + gap);
    for (const line of lines) { this.ensure(lineHeight); this.draw(line, x, this.y, size, font, color); this.y += lineHeight; }
    this.y += gap;
  }
  label(text: string) {
    this.ensure(42);
    this.text(text, { size: 8, font: this.mono, color: blue, gap: 10 });
  }
  table(columns: Column[], rows: string[][]) {
    const heading = () => {
      this.ensure(30); this.line(this.y, ink); this.y += 11;
      let x = M;
      for (const c of columns) { this.draw(c.label, x + 5, this.y, 7, this.mono, muted); x += c.width; }
      this.y += 21; this.line();
    };
    heading();
    for (const row of rows) {
      const cells = row.map((value, i) => wrapText(value, columns[i].numeric ? this.mono : this.sans, 9, columns[i].width - 12));
      const count = Math.max(...cells.map((lines) => lines.length));
      let offset = 0;
      // Normal rows move intact to the next page. Oversized rows continue safely.
      const maxLines = Math.floor((BOTTOM - 200) / 14);
      while (offset < count) {
        const length = Math.min(maxLines, count - offset), height = length * 14 + 14;
        if (this.y + height > BOTTOM) { this.newPage(this.section, true); heading(); }
        let x = M;
        cells.forEach((lines, i) => {
          const font = columns[i].numeric ? this.mono : this.sans;
          lines.slice(offset, offset + length).forEach((line, j) => this.draw(line, x + 5, this.y + 7 + j * 14, 9, font, i === columns.length - 1 && columns[i].numeric ? blue : ink));
          x += columns[i].width;
        });
        this.y += height; this.line(); offset += length;
      }
    }
    this.y += 20;
  }
  finish() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      this.page = page;
      this.line(H - 58);
      this.draw("Forma. / Candidate Intelligence", M, H - 45, 7.5, this.sans, muted);
      this.draw(`Analysis / ${this.report.analysis.id.slice(0, 8).toUpperCase()}`, M, H - 31, 7, this.mono, muted);
      const count = `Page ${index + 1} / ${pages.length}`;
      this.draw(count, W - M - this.mono.widthOfTextAtSize(count, 7), H - 39, 7, this.mono, muted);
    });
  }
}

function analysisSummary(c: ReportCanvas) {
  const r = c.report;
  c.newPage(names[r.type].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
  c.text(r.analysis.title, { size: 32, gap: 12 });
  if (r.analysis.jobTitle) c.text(r.analysis.jobTitle, { size: 14, color: muted });
  if (r.analysis.company) c.text(r.analysis.company, { size: 11, color: muted });
  c.text(`Generated ${new Date(r.generatedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC`, { size: 8, font: c.mono, color: muted });
  c.text(`Analysis ID / ${r.analysis.id}`, { size: 8, font: c.mono, color: muted, gap: 24 });
  c.label("ANALYSIS SUMMARY");
  const summary = [["Candidates analyzed", String(r.totalCandidates)]];
  if (r.type === "comparison") summary.push(["Candidates compared", String(r.candidates.length)]);
  else if (r.type === "top-candidates") summary.push(["Top candidates included", String(r.candidates.length)]);
  const top = r.type === "candidate" ? r.candidates[0] : r.type === "comparison" ? null : r.candidates[0];
  if (top) summary.push([r.type === "candidate" ? "Candidate" : "Top candidate", top.name], [r.type === "candidate" ? "Candidate score" : "Top candidate score", score(top.finalScore)]);
  if (r.requirements.required.length) summary.push(["Detected required requirements", String(r.requirements.required.length)]);
  if (r.requirements.preferred.length) summary.push(["Detected preferred requirements", String(r.requirements.preferred.length)]);
  c.table([{ label: "RECORD", width: 245 }, { label: "VALUE", width: CONTENT - 245 }], summary);
  c.label("RANKING METHODOLOGY");
  c.table([{ label: "SIGNAL", width: 330 }, { label: "CONFIGURED WEIGHT", width: CONTENT - 330, numeric: true }], [
    ["Semantic alignment", `${r.weights.semantic * 100}%`],
    ["Explicit requirements", `${r.weights.keyword * 100}%`],
    ["Requirement coverage", `${r.weights.skill * 100}%`],
  ]);
  c.text("Scores and ranks are persisted deterministic results. This report does not recalculate rankings. Weights shown are the application's current ranking configuration.", { size: 9, color: muted });
  c.text(EVIDENCE_DISCLAIMER, { size: 9, color: muted });
}

function scoreBreakdown(c: ReportCanvas, candidate: ReportCandidate, compact = false) {
  if (compact) {
    c.ensure(56); c.line(); c.y += 8;
    ["SEMANTIC", "EXPLICIT", "COVERAGE", "FINAL"].forEach((label, i) => {
      const x = M + i * CONTENT / 4;
      c.draw(label, x, c.y, 7, c.mono, muted);
      c.draw(score([candidate.semanticScore, candidate.explicitScore, candidate.coverageScore, candidate.finalScore][i], i === 3 ? 1 : 0), x, c.y + 14, 12, c.mono, i === 3 ? blue : ink);
    });
    c.y += 38; c.line(); c.y += 10; return;
  }
  c.table([
    { label: "SEMANTIC", width: CONTENT / 4, numeric: true }, { label: "EXPLICIT", width: CONTENT / 4, numeric: true },
    { label: "COVERAGE", width: CONTENT / 4, numeric: true }, { label: "FINAL", width: CONTENT / 4, numeric: true },
  ], [[score(candidate.semanticScore, 0), score(candidate.explicitScore, 0), score(candidate.coverageScore, 0), score(candidate.finalScore)]]);
}
function evidenceList(c: ReportCanvas, candidate: ReportCandidate, compact = false) {
  if (compact) {
    c.text("EVIDENCED / STORED REQUIREMENTS", { size: 7, font: c.mono, color: blue, gap: 4 });
    c.text(candidate.evidenced.join(" · ") || "No evidenced requirements recorded.", { gap: 6 });
    c.text("NOT EVIDENCED / STORED REQUIRED REQUIREMENTS", { size: 7, font: c.mono, color: blue, gap: 4 });
    c.text(candidate.notEvidenced.join(" · ") || "No not-evidenced required requirements recorded.", { gap: 6 });
    return;
  }
  c.label("EVIDENCED / STORED RANKING REQUIREMENTS");
  c.text(candidate.evidenced.join(" · ") || "No evidenced requirements recorded.");
  c.label("NOT EVIDENCED / STORED REQUIRED REQUIREMENTS");
  c.text(candidate.notEvidenced.join(" · ") || "No not-evidenced required requirements recorded.");
}
export function safeStoredExplanation(value: string | null) {
  if (!value?.trim()) return null;
  // Legacy prose that infers ability from absence is omitted, not regenerated.
  if (/\b(?:lacks?|lacking|does(?:n['’]t| not) know|has no experience|does(?:n['’]t| not) possess)\b/i.test(value)) return null;
  return value.replace(/\bmissing (?:required )?skills?\b/gi, "not-evidenced requirements");
}
function sourceReference(c: ReportCanvas, source: EvidenceReference) {
  const metadata = [source.candidateName, source.filename, source.pageNumber !== null ? `Page ${source.pageNumber}` : null, source.section].filter(Boolean).join(" / ");
  const excerpt = source.excerpt;
  const height = wrapText(excerpt, c.sans, 10, CONTENT - 16).length * 14.5 + wrapText(metadata, c.sans, 8, CONTENT).length * 11.6 + 78;
  if (height < BOTTOM - 200) c.ensure(height);
  c.label(`${source.matchedTerm.toUpperCase()} / ${source.matchType === "ALIASED" ? "ALIASED DOCUMENT EVIDENCE" : "DOCUMENT EVIDENCE"}`);
  c.text(excerpt, { x: M + 12, width: CONTENT - 16, size: 10 });
  c.text(metadata, { size: 8, color: muted, gap: 18 });
  c.line(); c.y += 18;
}
function candidateSummary(c: ReportCanvas, candidate: ReportCandidate, deep: boolean, compact = false) {
  c.ensure(170);
  if (compact) {
    c.draw(rank(candidate.rank), M, c.y, 30, c.mono, blue);
    c.text(candidate.name, { x: M + 60, width: CONTENT - 60, size: 18, gap: 4 });
    c.text(candidate.filename, { x: M + 60, width: CONTENT - 60, size: 8, color: muted, gap: 12 });
  } else {
    c.label(`RANK ${rank(candidate.rank)} / ${c.report.totalCandidates}`);
    c.text(candidate.name, { size: 21, gap: 6 });
    c.text(candidate.filename, { size: 8, color: muted, gap: 14 });
  }
  scoreBreakdown(c, candidate, compact);
  evidenceList(c, candidate, compact);
  const explanation = safeStoredExplanation(candidate.explanation);
  if (explanation) { c.label("WHY THIS RANK / STORED EXPLANATION"); c.text(explanation, { size: 10 }); }
  if (deep && candidate.evidence) {
    c.label("REQUIREMENT EVIDENCE / DOCUMENT REFERENCES");
    c.text("Document support is shown separately from stored ranking matches. Reference counts describe the available timeline references, not every occurrence in a resume.", { size: 9, color: muted });
    c.table([{ label: "REQUIREMENT", width: 150 }, { label: "TYPE", width: 70 }, { label: "DOCUMENT SUPPORT", width: CONTENT - 220 }], candidate.evidence.skills.map((s) => [
      s.skill, s.requirementType, s.status === "EVIDENCED" ? `${s.evidence.length} supporting reference${s.evidence.length === 1 ? "" : "s"}` : "Not evidenced - no supporting document evidence found.",
    ]));
    if (candidate.evidence.strongestEvidence.length) {
      c.label("STRONGEST EVIDENCE");
      for (const source of candidate.evidence.strongestEvidence.slice(0, 2)) sourceReference(c, source);
    }
  }
  c.y += compact ? 8 : 18;
}
function rankingTable(c: ReportCanvas) {
  c.newPage("Complete ranking");
  c.text(`${c.report.candidates.length} candidates / persisted rank order`, { font: c.mono, size: 8, color: muted, gap: 18 });
  c.table([
    { label: "RANK", width: 35, numeric: true }, { label: "CANDIDATE", width: 205 },
    { label: "SEMANTIC", width: 65, numeric: true }, { label: "EXPLICIT", width: 65, numeric: true },
    { label: "COVERAGE", width: 75, numeric: true }, { label: "FINAL", width: CONTENT - 445, numeric: true },
  ], c.report.candidates.map((p) => [rank(p.rank), p.name, score(p.semanticScore, 0), score(p.explicitScore, 0), score(p.coverageScore, 0), score(p.finalScore)]));
}
function requirementMatrix(c: ReportCanvas) {
  c.newPage("Candidate comparison");
  const people = c.report.candidates;
  const col = (CONTENT - 140) / people.length;
  const columns = [{ label: "METRIC", width: 140 }, ...people.map((p, i) => ({ label: `CANDIDATE ${i + 1}`, width: col, numeric: true }))];
  people.forEach((p, i) => c.text(`${i + 1} / ${p.name}`, { size: 10, gap: 4 }));
  c.y += 14;
  c.table(columns, [
    ["Rank", ...people.map((p) => rank(p.rank))], ["Final", ...people.map((p) => score(p.finalScore))],
    ["Semantic", ...people.map((p) => score(p.semanticScore, 0))], ["Explicit", ...people.map((p) => score(p.explicitScore, 0))],
    ["Coverage", ...people.map((p) => score(p.coverageScore, 0))],
  ]);
  c.label("REQUIREMENT EVIDENCE / DOCUMENT SUPPORT");
  const requirements = [...new Set(people.flatMap((p) => p.evidence?.skills.map((s) => s.skill) ?? []))];
  c.table([{ label: "REQUIREMENT", width: 140 }, ...people.map((_, i) => ({ label: `CANDIDATE ${i + 1}`, width: col }))], requirements.map((skill) => [skill, ...people.map((p) => p.evidence?.skills.find((s) => s.skill === skill)?.status === "EVIDENCED" ? "Evidenced" : "Not evidenced")]));
  c.text(EVIDENCE_DISCLAIMER, { size: 9, color: muted });
  c.newPage("Comparison evidence");
  for (const p of people) {
    c.ensure(140);
    c.label(`RANK ${rank(p.rank)} / ${c.report.totalCandidates}`);
    c.text(p.name, { size: 19, gap: 12 });
    const sources = p.evidence?.strongestEvidence.slice(0, 2) ?? [];
    if (sources.length) for (const source of sources) sourceReference(c, source);
    else c.text("No supporting document references are available in the evidence timeline.", { size: 9, color: muted });
  }
}

/** Shared report engine: no browser, network model calls, or temporary PDF files. */
export async function renderFormaReport(report: FormaReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const sans = await doc.embedFont(await reportFont(), { subset: true });
  const mono = await doc.embedFont(StandardFonts.Courier);
  doc.setTitle(`${names[report.type]} / ${report.analysis.title}`);
  doc.setAuthor("Forma."); doc.setCreator("Forma. Report Engine");
  doc.setCreationDate(new Date(report.generatedAt)); doc.setModificationDate(new Date(report.generatedAt));
  const c = new ReportCanvas(doc, sans, mono, report);
  analysisSummary(c);
  if (report.type === "shortlist" || report.type === "top-candidates") {
    c.newPage("Leading candidates");
    for (const p of report.candidates.slice(0, 3)) candidateSummary(c, p, report.type === "top-candidates", report.type === "shortlist");
  }
  if (report.type === "shortlist" || report.type === "ranking") rankingTable(c);
  if (report.type === "shortlist") {
    c.newPage("Requirement evidence summary");
    for (const p of report.candidates) {
      c.ensure(100); c.text(`${rank(p.rank)} / ${p.name}`, { size: 14 });
      evidenceList(c, p);
      if (p.evidence?.strongestEvidence.length) for (const source of p.evidence.strongestEvidence.slice(0, 2)) sourceReference(c, source);
      c.line(); c.y += 18;
    }
  }
  if (report.type === "candidate") { c.newPage("Candidate detail"); candidateSummary(c, report.candidates[0], true); }
  if (report.type === "comparison") requirementMatrix(c);
  c.finish(); return doc.save();
}
