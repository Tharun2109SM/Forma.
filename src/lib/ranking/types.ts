export type CandidateSignals = {
  id: string;
  semanticScore: number;
  keywordScore: number;
  skillScore: number;
  matchedSkills: string[];
  missingSkills: string[];
};

export type RankedCandidate = CandidateSignals & {
  finalScore: number;
  rank: number;
};

export type HybridWeights = {
  semantic: number;
  keyword: number;
  skill: number;
};
