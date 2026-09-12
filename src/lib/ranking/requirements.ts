import { normalizeSkill, normalizeText, skillVariants } from "@/lib/ranking/normalize";

const SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "C++",
  "C#",
  ".NET",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "REST APIs",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "Git",
  "CI/CD",
  "Kafka",
  "Spark",
  "Machine Learning",
  "Data Engineering",
  "System Design",
  "Microservices",
] as const;

export type WeightedRequirements = {
  required: string[];
  preferred: string[];
  general: string[];
};

function includesSkill(line: string, skill: string) {
  const normalized = normalizeText(line);
  return skillVariants(skill).some((variant) => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "i").test(normalized);
  });
}

export function extractWeightedRequirements(jobDescription: string): WeightedRequirements {
  const result: WeightedRequirements = { required: [], preferred: [], general: [] };
  let section: keyof WeightedRequirements = "general";

  for (const rawLine of jobDescription.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/\b(preferred|nice[- ]to[- ]have|bonus)\b/i.test(line)) section = "preferred";
    else if (/\b(required|must|required qualifications?|minimum qualifications?)\b/i.test(line)) {
      section = "required";
    }

    for (const skill of SKILLS) {
      if (!includesSkill(line, skill)) continue;
      const canonical = normalizeSkill(skill);
      if (!result[section].includes(canonical)) result[section].push(canonical);
    }
  }

  const assigned = new Set([...result.required, ...result.preferred]);
  result.general = result.general.filter((skill) => !assigned.has(skill));
  result.preferred = result.preferred.filter((skill) => !result.required.includes(skill));
  return result;
}

export function matchWeightedRequirements(
  resumeText: string,
  requirements: WeightedRequirements,
) {
  const normalizedResume = normalizeText(resumeText);
  const categoryWeights = { required: 0.6, preferred: 0.25, general: 0.15 } as const;
  const presentCategories = (Object.keys(categoryWeights) as Array<keyof WeightedRequirements>)
    .filter((category) => requirements[category].length > 0);
  const totalWeight = presentCategories.reduce(
    (total, category) => total + categoryWeights[category],
    0,
  );
  const matches = (skills: string[]) =>
    skills.filter((skill) =>
      skillVariants(skill).some((variant) => normalizedResume.includes(variant)),
    );
  const requiredMatches = matches(requirements.required);
  const preferredMatches = matches(requirements.preferred);
  const generalMatches = matches(requirements.general);
  const weightedScore = presentCategories.reduce((score, category) => {
    const skills = requirements[category];
    const count =
      category === "required"
        ? requiredMatches.length
        : category === "preferred"
          ? preferredMatches.length
          : generalMatches.length;
    return score + (count / skills.length) * categoryWeights[category];
  }, 0);

  return {
    keywordScore: totalWeight === 0 ? 100 : (weightedScore / totalWeight) * 100,
    requiredScore:
      requirements.required.length === 0
        ? 100
        : (requiredMatches.length / requirements.required.length) * 100,
    matched: [...new Set([...requiredMatches, ...preferredMatches, ...generalMatches])],
    missingRequired: requirements.required.filter(
      (skill) => !requiredMatches.includes(skill),
    ),
  };
}
