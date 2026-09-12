export function requiredSkillCoverage(matched: string[], required: string[]) {
  if (required.length === 0) return 100;
  const matchedSet = new Set(matched);
  return (required.filter((skill) => matchedSet.has(skill)).length / required.length) * 100;
}
