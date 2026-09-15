import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortCandidates } from "@/lib/candidate-search";

const candidates = [
  { analysisId: "a", name: "Priya Nair", resumeFilename: "priya_nair_resume.pdf", matchedSkills: ["React", "TypeScript"], finalScore: 82.6, rank: 4, createdAt: "2026-09-12" },
  { analysisId: "a", name: "Rohan Shah", resumeFilename: "rohan_shah_2026.pdf", matchedSkills: ["React", "Node.js"], finalScore: 85.2, rank: 3, createdAt: "2026-09-13" },
  { analysisId: "b", name: "Maya Reddy", resumeFilename: "frontend_architect.pdf", matchedSkills: ["Design systems"], finalScore: 88.6, rank: 2, createdAt: "2026-09-14" },
];

function names(query: string) {
  return filterAndSortCandidates(candidates, { query, sort: "newest" }).map((item) => item.name);
}

test("live candidate search handles progressive name prefixes and whitespace", () => {
  for (const query of ["p", "pr", "pri", "priya", "  PRIYA  "]) {
    assert.deepEqual(names(query), ["Priya Nair"]);
  }
});

test("candidate search matches surname, filename, and skill", () => {
  assert.deepEqual(names("shah"), ["Rohan Shah"]);
  assert.deepEqual(names("frontend_architect"), ["Maya Reddy"]);
  assert.deepEqual(names("typescript"), ["Priya Nair"]);
});

test("search relevance never mutates persisted ranks", () => {
  const before = candidates.map((item) => item.rank);
  assert.deepEqual(names("rohan"), ["Rohan Shah"]);
  assert.deepEqual(candidates.map((item) => item.rank), before);
});

test("analysis and exact skill filters compose with search", () => {
  const result = filterAndSortCandidates(candidates, {
    query: "",
    analysisId: "a",
    skill: "react",
    sort: "score",
  });
  assert.deepEqual(result.map((item) => item.name), ["Rohan Shah", "Priya Nair"]);
});
