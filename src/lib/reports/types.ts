import type { CandidateEvidenceData } from "@/lib/evidence/derive";
import type { HybridWeights } from "@/lib/ranking/types";

export const REPORT_TYPES = ["shortlist", "ranking", "top-candidates", "candidate", "comparison"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportSelection = { type: ReportType; candidateIds: string[] };
export type ReportCandidate = {
  id: string;
  name: string;
  filename: string;
  rank: number | null;
  finalScore: number | null;
  semanticScore: number | null;
  explicitScore: number | null;
  coverageScore: number | null;
  evidenced: string[];
  notEvidenced: string[];
  explanation: string | null;
  evidence?: CandidateEvidenceData;
};
export type FormaReport = {
  type: ReportType;
  analysis: { id: string; title: string; jobTitle: string | null; company: string | null; jdFilename: string | null };
  generatedAt: string;
  totalCandidates: number;
  candidates: ReportCandidate[];
  weights: HybridWeights;
  requirements: { required: string[]; preferred: string[]; general: string[] };
};
