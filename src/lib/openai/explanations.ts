import "server-only";

import { getOpenAIClient } from "@/lib/openai/client";
import type { RankedCandidate } from "@/lib/ranking/types";

export type ExplanationRequest = {
  model: string;
  jobTitle: string;
  requiredSkills: string[];
  candidates: RankedCandidate[];
};

// Explanations consume completed ranks. The model never assigns or changes scores.
export async function explainTopCandidates({
  model,
  jobTitle,
  requiredSkills,
  candidates,
}: ExplanationRequest) {
  const topThree = candidates.slice(0, 3).map((candidate) => ({
    id: candidate.id,
    rank: candidate.rank,
    finalScore: candidate.finalScore,
    semanticScore: candidate.semanticScore,
    keywordScore: candidate.keywordScore,
    skillScore: candidate.skillScore,
    matchedSkills: candidate.matchedSkills,
    missingSkills: candidate.missingSkills,
  }));

  const response = await getOpenAIClient().responses.create({
    model,
    instructions:
      "Explain the supplied deterministic ranking. Do not invent evidence, recalculate scores, or change rank order.",
    input: JSON.stringify({ jobTitle, requiredSkills, candidates: topThree }),
  });

  return response.output_text;
}
