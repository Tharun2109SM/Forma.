import {
  normalizeText,
  skillVariants,
  uniqueNormalizedSkills,
} from "@/lib/ranking/normalize";

export type KeywordMatch = {
  score: number;
  matched: string[];
  missing: string[];
};

export function matchExplicitSkills(
  resumeText: string,
  requiredSkills: string[],
): KeywordMatch {
  const normalizedResume = normalizeText(resumeText);
  const required = uniqueNormalizedSkills(requiredSkills);
  const matched = required.filter((skill) =>
    skillVariants(skill).some((variant) => normalizedResume.includes(variant)),
  );
  const missing = required.filter((skill) => !matched.includes(skill));

  return {
    score: required.length === 0 ? 100 : (matched.length / required.length) * 100,
    matched,
    missing,
  };
}
