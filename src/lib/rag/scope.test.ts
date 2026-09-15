import assert from "node:assert/strict";
import test from "node:test";
import {
  scopeComparisonSources,
  EVIDENCE_LANGUAGE_RULE,
  RANKING_RULE,
} from "./scope";
test("comparison retrieval preserves JD and selected candidates only", () => {
  const rows = [
    { candidate_id: null, document_type: "JOB_DESCRIPTION" },
    { candidate_id: "A", document_type: "RESUME" },
    { candidate_id: "B", document_type: "RESUME" },
    { candidate_id: "foreign", document_type: "RESUME" },
  ];
  assert.deepEqual(scopeComparisonSources(rows, ["A", "B"]), rows.slice(0, 3));
  assert.deepEqual(scopeComparisonSources(rows), rows);
});
test("shared answer contract prohibits rank mutation and negative absence claims", () => {
  assert.match(RANKING_RULE, /Do not calculate or change rankings/);
  assert.match(EVIDENCE_LANGUAGE_RULE, /never that the candidate lacks/);
  assert.match(EVIDENCE_LANGUAGE_RULE, /inference explicitly/);
});
