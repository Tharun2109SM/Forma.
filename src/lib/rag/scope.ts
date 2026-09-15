export function scopeComparisonSources<
  T extends { candidate_id: string | null; document_type: string },
>(rows: T[], candidateIds?: string[]) {
  if (!candidateIds) return rows;
  const selected = new Set(candidateIds);
  return rows.filter(
    (row) =>
      row.document_type === "JOB_DESCRIPTION" ||
      (row.candidate_id !== null && selected.has(row.candidate_id)),
  );
}
export const EVIDENCE_LANGUAGE_RULE =
  "Missing skills mean NOT EVIDENCED in uploaded documents, never that the candidate lacks or does not know the skill. Distinguish documented fact, absence of documented evidence, and inference explicitly.";
export const RANKING_RULE =
  "Do not calculate or change rankings. Explain only supplied deterministic scores when present.";
