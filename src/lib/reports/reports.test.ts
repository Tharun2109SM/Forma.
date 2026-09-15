import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { extractText } from "unpdf";
import type { Database } from "@/types/database";
import { DEFAULT_WEIGHTS } from "@/lib/ranking/score";
import { exportPdfResponse } from "./http";
import { loadFormaReport } from "./service";
import { renderFormaReport, safeStoredExplanation, EVIDENCE_DISCLAIMER } from "./pdf";
import { parseReportSelection, reportFilename } from "./selection";

const ANALYSIS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function fixture(count = 18, options: { signedOut?: boolean; wrongUser?: boolean; status?: string; absent?: boolean; failTable?: string; changed?: boolean } = {}) {
  const records: Record<string, Record<string, unknown>[]> = {
    analyses: options.absent ? [] : [{ id: ANALYSIS, user_id: "owner", title: "Fixture shortlist", job_title: "Fixture backend role", company_name: "Test only", jd_filename: "fixture-jd.txt", jd_text: "Required\nReact Docker\nPreferred\nPostgreSQL", status: options.status ?? "COMPLETED", candidate_count: count, updated_at: "2026-09-15T00:00:00Z" }],
    candidates: Array.from({ length: count }, (_, i) => ({ id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`, analysis_id: ANALYSIS, name: `Fixture Candidate ${String(i + 1).padStart(3, "0")}`, resume_filename: `fixture-resume-${i + 1}.txt`, resume_text: "Built React applications.", rank: i + 1, final_score: 76.1 - i / 10, semantic_score: 65, keyword_score: 79, skill_score: 100, matched_skills: ["react"], missing_skills: ["docker"], explanation: i === 0 ? "The stored ranking places this candidate first on explicit requirement alignment." : null })),
    documents: [], document_chunks: [],
  };
  const queries: { table: string; filters: [string, unknown][]; range?: number[] }[] = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: options.wrongUser ? "intruder" : "owner" } }, error: null }) },
    from(table: string) {
      const q = { table, filters: [] as [string, unknown][], range: undefined as number[] | undefined };
      queries.push(q);
      let selectedIds: unknown[] | undefined;
      const run = () => {
        if (options.failTable === table) return { data: null, error: { message: "SECRET database error" } };
        let data = [...(records[table] ?? [])].filter((r) => q.filters.every(([key, value]) => r[key] === value));
        if (selectedIds) data = data.filter((r) => selectedIds!.includes(r.id) || selectedIds!.includes(r.candidate_id));
        if (q.range) data = data.slice(q.range[0], q.range[1] + 1);
        if (options.changed && table === "analyses" && queries.filter((q) => q.table === table).length > 1) data = data.map((r) => ({ ...r, status: "PROCESSING" }));
        return { data, error: null };
      };
      const query = {
        select: () => query,
        eq(key: string, value: unknown) { q.filters.push([key, value]); return query; },
        in(_key: string, ids: unknown[]) { selectedIds = ids; return query; },
        order: () => query,
        range(from: number, to: number) { q.range = [from, to]; return query; },
        maybeSingle: async () => { const result = run(); return { ...result, data: result.data?.[0] ?? null }; },
        then(resolve: (result: ReturnType<typeof run>) => unknown) { return Promise.resolve(run()).then(resolve); },
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, records, queries };
}
const request = (query = "type=ranking") => new Request(`http://localhost/api/analysis/${ANALYSIS}/export/pdf?${query}`);

test("report options validate report type and every selection", () => {
  assert.equal(parseReportSelection(new URLSearchParams()).type, "shortlist");
  for (const query of ["type=nope", "candidateIds=bad", "type=ranking&candidateIds=", "type=candidate", "type=comparison", "type=ranking&type=shortlist", "filtered=true"]) assert.throws(() => parseReportSelection(new URLSearchParams(query)));
});
test("filename sanitization handles accents, paths, header injection, and empty titles", () => {
  assert.equal(reportFilename("../Développeur React\r\nX-Key: secret", "shortlist"), "forma-developpeur-react-x-key-secret-shortlist.pdf");
  assert.equal(reportFilename("日本語", "candidate"), "forma-analysis-candidate-report.pdf");
  assert.ok(reportFilename("a".repeat(300), "comparison").length < 110);
});
test("unauthenticated, wrong-user, absent, and incomplete exports are rejected", async () => {
  for (const [options, status] of [[{ signedOut: true }, 401], [{ wrongUser: true }, 404], [{ absent: true }, 404], [{ status: "PROCESSING" }, 409], [{ status: "FAILED" }, 409]] as const) {
    const { supabase, queries } = fixture(18, options);
    const response = await exportPdfResponse(request(), ANALYSIS, supabase);
    assert.equal(response.status, status);
    assert.equal(queries.some((q) => q.table === "candidates"), false);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});
test("cross-analysis candidate and comparison selections cannot be exported", async () => {
  const { supabase, records } = fixture();
  records.candidates.push({ ...records.candidates[0], id: OTHER, analysis_id: OTHER });
  const first = String(records.candidates[0].id);
  for (const query of [`type=candidate&candidateIds=${OTHER}`, `type=comparison&candidateIds=${first},${OTHER}`]) {
    assert.equal((await exportPdfResponse(request(query), ANALYSIS, supabase)).status, 404);
  }
});
test("retrieval errors do not expose database internals", async () => {
  const { supabase } = fixture(18, { failTable: "candidates" });
  const response = await exportPdfResponse(request(), ANALYSIS, supabase);
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /SECRET/);
});
test("a restarted analysis cannot produce a mixed report", async () => {
  const { supabase } = fixture(18, { changed: true });
  assert.equal((await exportPdfResponse(request(), ANALYSIS, supabase)).status, 409);
});
test("missing stored scores stay null instead of acquiring synthetic values", async () => {
  const { supabase, records } = fixture(1);
  Object.assign(records.candidates[0], { rank: null, final_score: null, semantic_score: null });
  const report = await loadFormaReport(supabase, ANALYSIS, { type: "ranking", candidateIds: [] });
  assert.equal(report.candidates[0].rank, null); assert.equal(report.candidates[0].finalScore, null);
  const text = (await extractText(await renderFormaReport(report), { mergePages: true })).text;
  assert.match(text, /N\/A/);
});
test("full ranking retrieval paginates past API row limits and preserves stored order and weights", async () => {
  const { supabase, queries } = fixture(1101);
  const report = await loadFormaReport(supabase, ANALYSIS, { type: "ranking", candidateIds: [] });
  assert.equal(report.candidates.length, 1101);
  assert.equal(report.candidates.at(-1)!.rank, 1101);
  assert.deepEqual(report.weights, DEFAULT_WEIGHTS);
  assert.equal(queries.filter((q) => q.table === "candidates").length, 3);
  assert.ok(queries.filter((q) => q.table === "analyses").every((q) => q.filters.some(([key, value]) => key === "user_id" && value === "owner")));
});
for (const count of [18, 50, 100]) test(`${count}-candidate shortlist is paginated with exact persisted ranking and scores`, async () => {
  const { supabase } = fixture(count);
  const report = await loadFormaReport(supabase, ANALYSIS, { type: "shortlist", candidateIds: [] });
  const started = Date.now(), bytes = await renderFormaReport(report);
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 4);
  const extracted = await extractText(bytes, { mergePages: true });
  const text = extracted.text;
  let previous = -1;
  const complete = text.slice(text.indexOf("Complete ranking"));
  for (const candidate of report.candidates) {
    const at = complete.indexOf(candidate.name);
    assert.ok(at > previous, `${candidate.name} remains in rank order`); previous = at;
    assert.match(text, new RegExp(candidate.finalScore!.toFixed(1).replace(".", "\\.")));
  }
  assert.match(text, /NOT EVIDENCED/); assert.doesNotMatch(text, /missing skills|candidate lacks/i);
  assert.match(text, /does not necessarily mean/);
  assert.match(text, new RegExp(`Page ${doc.getPageCount()} / ${doc.getPageCount()}`));
  assert.ok(Date.now() - started < 15_000, "bounded in-memory generation");
});
test("candidate and comparison PDFs reuse document evidence and include actual provenance", async () => {
  const { supabase, records } = fixture(3);
  const id = String(records.candidates[0].id);
  records.documents.push({ id: OTHER, analysis_id: ANALYSIS, candidate_id: id, document_type: "RESUME", filename: "actual-fixture.txt", status: "READY", extracted_text: "Built React applications." });
  records.document_chunks.push({ id: "chunk", analysis_id: ANALYSIS, candidate_id: id, document_id: OTHER, document_type: "RESUME", content: "Built React applications.", page_number: 2, section_label: "Projects", chunk_index: 0 });
  for (const selection of [{ type: "candidate" as const, candidateIds: [id] }, { type: "comparison" as const, candidateIds: [id, String(records.candidates[1].id)] }]) {
    const report = await loadFormaReport(supabase, ANALYSIS, selection);
    assert.equal(report.candidates.length, selection.candidateIds.length);
    const text = (await extractText(await renderFormaReport(report), { mergePages: true })).text;
    assert.match(text, /Built React applications/); assert.match(text, /actual-fixture\.txt/); assert.match(text, /Page 2/); assert.match(text, /Projects/);
    assert.doesNotMatch(text, /Fixture Candidate 003/);
  }
});
test("long titles, names, skill lists, and accented names wrap without changing data", async () => {
  const { supabase, records } = fixture(18);
  records.analyses[0].title = "Senior distributed backend platform engineer ".repeat(6);
  records.candidates[0].name = "José Zoë Müller Łukasz O’Connor";
  records.candidates[1].name = "An unusually long candidate name ".repeat(7);
  records.candidates[0].matched_skills = Array.from({ length: 80 }, (_, i) => `Persisted requirement ${i + 1}`);
  const report = await loadFormaReport(supabase, ANALYSIS, { type: "shortlist", candidateIds: [] });
  const text = (await extractText(await renderFormaReport(report), { mergePages: true })).text;
  assert.match(text, /José Zoë Müller Łukasz O’Connor/); assert.match(text, /Persisted requirement 80/);
});
test("legacy absence-as-ability explanations are not regenerated or exported", () => {
  assert.equal(safeStoredExplanation("Candidate lacks Docker."), null);
  assert.equal(safeStoredExplanation("Candidate doesn't know Redis."), null);
  assert.equal(safeStoredExplanation("Missing skills: Docker"), "not-evidenced requirements: Docker");
  assert.match(EVIDENCE_DISCLAIMER, /does not necessarily mean/);
});
test("authenticated download returns a private PDF attachment", async () => {
  const { supabase } = fixture();
  const response = await exportPdfResponse(request(), ANALYSIS, supabase);
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition")!, /forma-fixture-backend-role-ranking\.pdf/);
  assert.ok((await response.arrayBuffer()).byteLength > 1000);
});
