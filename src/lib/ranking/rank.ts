import { calculateHybridScore } from "@/lib/ranking/score";
import type {
  CandidateSignals,
  HybridWeights,
  RankedCandidate,
} from "@/lib/ranking/types";

export function rankCandidates(
  candidates: CandidateSignals[],
  weights?: HybridWeights,
): RankedCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      finalScore: calculateHybridScore(candidate, weights),
    }))
    .sort(
      (left, right) =>
        right.finalScore - left.finalScore ||
        right.semanticScore - left.semanticScore ||
        left.id.localeCompare(right.id),
    )
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
