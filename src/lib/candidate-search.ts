export type CandidateSearchRecord = {
  analysisId: string;
  name: string;
  resumeFilename: string;
  matchedSkills: string[];
  finalScore: number | null;
  rank: number | null;
  createdAt: string;
};

export type CandidateLibrarySort = "newest" | "score";

export function normalizeCandidateQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function candidateMatchPriority(candidate: CandidateSearchRecord, query: string) {
  const term = normalizeCandidateQuery(query);
  if (!term) return 0;

  const name = normalizeCandidateQuery(candidate.name);
  const filename = normalizeCandidateQuery(candidate.resumeFilename.replace(/\.[^.]+$/i, ""));
  const tokens = name.split(" ");
  const skills = candidate.matchedSkills.map(normalizeCandidateQuery);

  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (tokens.some((token) => token.startsWith(term))) return 2;
  if (name.includes(term)) return 3;
  if (filename.includes(term)) return 4;
  if (term.length >= 3 && skills.some((skill) => skill.includes(term))) return 5;
  return Number.POSITIVE_INFINITY;
}

export function filterAndSortCandidates<T extends CandidateSearchRecord>(
  candidates: T[],
  options: {
    query: string;
    analysisId?: string;
    skill?: string;
    sort: CandidateLibrarySort;
  },
) {
  const query = normalizeCandidateQuery(options.query);
  const skill = normalizeCandidateQuery(options.skill ?? "");

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      priority: candidateMatchPriority(candidate, query),
    }))
    .filter(({ candidate, priority }) => {
      if (options.analysisId && candidate.analysisId !== options.analysisId) {
        return false;
      }
      if (skill && !candidate.matchedSkills.some((item) => normalizeCandidateQuery(item) === skill)) {
        return false;
      }
      return Number.isFinite(priority);
    })
    .sort((a, b) => {
      if (query && a.priority !== b.priority) return a.priority - b.priority;
      if (options.sort === "score") {
        const scoreDifference = (b.candidate.finalScore ?? -1) - (a.candidate.finalScore ?? -1);
        if (scoreDifference) return scoreDifference;
      } else {
        const dateDifference = b.candidate.createdAt.localeCompare(a.candidate.createdAt);
        if (dateDifference) return dateDifference;
      }
      const rankDifference = (a.candidate.rank ?? Number.MAX_SAFE_INTEGER)
        - (b.candidate.rank ?? Number.MAX_SAFE_INTEGER);
      return rankDifference || a.index - b.index;
    })
    .map(({ candidate }) => candidate);
}
