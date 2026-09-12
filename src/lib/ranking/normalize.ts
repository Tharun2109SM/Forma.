const aliasGroups: Record<string, string[]> = {
  react: ["react", "reactjs", "react.js"],
  "node.js": ["node", "nodejs", "node.js"],
  javascript: ["javascript", "js", "ecmascript"],
  typescript: ["typescript", "ts"],
  postgresql: ["postgres", "postgresql", "psql"],
};

const aliases = new Map(
  Object.entries(aliasGroups).flatMap(([canonical, values]) =>
    values.map((value) => [value, canonical] as const),
  ),
);

export function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSkill(value: string) {
  const normalized = normalizeText(value);
  return aliases.get(normalized) ?? normalized;
}

export function skillVariants(value: string) {
  const canonical = normalizeSkill(value);
  return aliasGroups[canonical] ?? [canonical];
}

export function uniqueNormalizedSkills(skills: string[]) {
  return [...new Set(skills.map(normalizeSkill).filter(Boolean))];
}
