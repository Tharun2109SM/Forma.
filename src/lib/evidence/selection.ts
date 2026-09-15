import { z } from "zod";

export function validateCandidateSelection(ids: unknown, min = 2): string[] {
  const parsed = z.array(z.uuid()).min(min).max(4).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length)
    throw new Error("Select 2–4 distinct candidates from this analysis.");
  return parsed.data;
}
export function selectionBelongsToAnalysis(
  ids: string[],
  rows: { id: string; analysis_id: string }[],
  analysisId: string,
) {
  return ids.every((id) =>
    rows.some((row) => row.id === id && row.analysis_id === analysisId),
  );
}
