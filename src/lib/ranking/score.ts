import type { CandidateSignals, HybridWeights } from "@/lib/ranking/types";

export const DEFAULT_WEIGHTS: HybridWeights = {
  semantic: 0.5,
  keyword: 0.3,
  skill: 0.2,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function validateWeights(weights: HybridWeights) {
  const total = weights.semantic + weights.keyword + weights.skill;
  if (
    Math.abs(total - 1) > 0.0001 ||
    Object.values(weights).some((value) => value < 0)
  ) {
    throw new Error("Hybrid weights must be non-negative and sum to 1.");
  }
}

export function calculateHybridScore(
  signals: Pick<CandidateSignals, "semanticScore" | "keywordScore" | "skillScore">,
  weights: HybridWeights = DEFAULT_WEIGHTS,
) {
  validateWeights(weights);
  const score =
    clampScore(signals.semanticScore) * weights.semantic +
    clampScore(signals.keywordScore) * weights.keyword +
    clampScore(signals.skillScore) * weights.skill;
  return Math.round(score * 10) / 10;
}
