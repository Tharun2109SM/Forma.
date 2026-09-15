import { normalizeSkill, skillVariants } from "@/lib/ranking/normalize";
import { extractWeightedRequirements } from "@/lib/ranking/requirements";

export type RequirementType = "required" | "preferred" | "general";
export type EvidenceReference = {
  id: string;
  candidateId: string;
  candidateName: string;
  documentId: string;
  filename: string;
  pageNumber: number | null;
  section: string | null;
  chunkIndex: number | null;
  excerpt: string;
  context: string;
  matchedTerm: string;
  matchType: "DIRECT" | "ALIASED";
  evidenceType:
    | "EXPERIENCE"
    | "PROJECT"
    | "SKILLS"
    | "EDUCATION"
    | "CERTIFICATION"
    | "SUMMARY"
    | "OTHER";
  origin: "DOCUMENT_CHUNK" | "EXTRACTED_TEXT";
};
export type SkillEvidence = {
  skill: string;
  requirementType: RequirementType;
  status: "EVIDENCED" | "NOT_EVIDENCED";
  storedMatched: boolean;
  evidence: EvidenceReference[];
};
export type EvidenceCandidate = {
  id: string;
  analysis_id: string;
  name: string | null;
  resume_filename: string;
  resume_text: string | null;
  rank: number | null;
  final_score: number | null;
  semantic_score: number | null;
  keyword_score: number | null;
  skill_score: number | null;
  matched_skills: unknown;
  missing_skills: unknown;
};
export type EvidenceDocument = {
  id: string;
  analysis_id: string;
  candidate_id: string | null;
  document_type: string;
  filename: string;
  extracted_text: string | null;
  status: string;
};
export type EvidenceChunk = {
  id: string;
  analysis_id: string;
  candidate_id: string | null;
  document_id: string;
  document_type: string;
  content: string;
  page_number: number | null;
  section_label: string | null;
  chunk_index: number;
};
export type CandidateEvidenceData = {
  candidate: {
    id: string;
    name: string;
    filename: string;
    rank: number | null;
    finalScore: number | null;
    semanticScore: number | null;
    keywordScore: number | null;
    coverageScore: number | null;
  };
  skills: SkillEvidence[];
  strongestEvidence: EvidenceReference[];
  indexedChunkCount: number;
  documents: { id: string; filename: string; status: string }[];
};

export function stringSkills(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((v): v is string => typeof v === "string")
            .map(normalizeSkill),
        ),
      ]
    : [];
}
export function requirementList(jd: string) {
  const categories = extractWeightedRequirements(jd);
  return (Object.keys(categories) as RequirementType[]).flatMap(
    (requirementType) =>
      categories[requirementType].map((skill) => ({ skill, requirementType })),
  );
}
export function classifySection(
  section: string | null,
): EvidenceReference["evidenceType"] {
  if (!section) return "OTHER";
  if (/experience|employment|work history/i.test(section)) return "EXPERIENCE";
  if (/project/i.test(section)) return "PROJECT";
  if (/skill|technolog/i.test(section)) return "SKILLS";
  if (/education/i.test(section)) return "EDUCATION";
  if (/certificat/i.test(section)) return "CERTIFICATION";
  if (/summary|profile/i.test(section)) return "SUMMARY";
  return "OTHER";
}
const sectionPriority = {
  EXPERIENCE: 0,
  PROJECT: 1,
  SKILLS: 2,
  CERTIFICATION: 3,
  EDUCATION: 4,
  SUMMARY: 5,
  OTHER: 6,
};
export function findSkillTerm(text: string, skill: string) {
  const canonical = normalizeSkill(skill);
  // Boundary-aware matching avoids React in "reactive" or Go in "Google".
  const variants = [
    canonical,
    ...skillVariants(canonical).filter((v) => v !== canonical),
  ];
  for (const variant of variants) {
    const escaped = variant
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/ /g, "\\s+");
    const match = new RegExp(
      `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,
      "iu",
    ).exec(text);
    if (match)
      return {
        term: match[0],
        index: match.index,
        type:
          variant === canonical ? ("DIRECT" as const) : ("ALIASED" as const),
      };
  }
  return null;
}
function excerptAround(text: string, index: number) {
  const start = Math.max(0, index - 180),
    end = Math.min(text.length, index + 380);
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function deriveCandidateEvidence(
  candidate: EvidenceCandidate,
  jd: string,
  documents: EvidenceDocument[],
  chunks: EvidenceChunk[],
): CandidateEvidenceData {
  const ownDocuments = documents.filter(
    (d) =>
      d.analysis_id === candidate.analysis_id &&
      d.candidate_id === candidate.id &&
      d.document_type === "RESUME",
  );
  const documentMap = new Map(ownDocuments.map((d) => [d.id, d]));
  const ownChunks = chunks.filter(
    (c) =>
      c.analysis_id === candidate.analysis_id &&
      c.candidate_id === candidate.id &&
      c.document_type === "RESUME" &&
      documentMap.has(c.document_id),
  );
  const name = candidate.name ?? candidate.resume_filename;
  const matched = new Set(stringSkills(candidate.matched_skills));
  const missing = stringSkills(candidate.missing_skills);
  const requirements = requirementList(jd);
  for (const skill of [...matched, ...missing])
    if (!requirements.some((r) => r.skill === skill))
      requirements.push({
        skill,
        requirementType: missing.includes(skill) ? "required" : "general",
      });
  const skills = requirements.map(
    ({ skill, requirementType }): SkillEvidence => {
      const evidence: EvidenceReference[] = [];
      // Never promote an absent requirement into a stored ranking match.
      if (matched.has(skill)) {
        for (const chunk of ownChunks) {
          const match = findSkillTerm(chunk.content, skill);
          if (!match) continue;
          evidence.push({
            id: chunk.id,
            candidateId: candidate.id,
            candidateName: name,
            documentId: chunk.document_id,
            filename: documentMap.get(chunk.document_id)!.filename,
            pageNumber: chunk.page_number,
            section: chunk.section_label,
            chunkIndex: chunk.chunk_index,
            excerpt: excerptAround(chunk.content, match.index),
            context: chunk.content,
            matchedTerm: match.term,
            matchType: match.type,
            evidenceType: classifySection(chunk.section_label),
            origin: "DOCUMENT_CHUNK",
          });
        }
        // Native extraction is usable even before indexing. Do not manufacture page/section metadata.
        if (!evidence.length)
          for (const doc of ownDocuments) {
            const text = doc.extracted_text;
            if (!text) continue;
            const match = findSkillTerm(text, skill);
            if (match)
              evidence.push({
                id: `extracted-${doc.id}-${skill}`,
                candidateId: candidate.id,
                candidateName: name,
                documentId: doc.id,
                filename: doc.filename,
                pageNumber: null,
                section: null,
                chunkIndex: null,
                excerpt: excerptAround(text, match.index),
                context: text.slice(
                  Math.max(0, match.index - 1200),
                  match.index + 2400,
                ),
                matchedTerm: match.term,
                matchType: match.type,
                evidenceType: "OTHER",
                origin: "EXTRACTED_TEXT",
              });
          }
      }
      evidence.sort(
        (a, b) =>
          Number(a.matchType === "ALIASED") -
            Number(b.matchType === "ALIASED") ||
          sectionPriority[a.evidenceType] - sectionPriority[b.evidenceType] ||
          (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0),
      );
      const unique = evidence
        .filter(
          (e, i) =>
            evidence.findIndex(
              (other) =>
                other.documentId === e.documentId &&
                other.excerpt === e.excerpt,
            ) === i,
        )
        .slice(0, 6);
      return {
        skill,
        requirementType,
        storedMatched: matched.has(skill),
        status: unique.length ? "EVIDENCED" : "NOT_EVIDENCED",
        evidence: unique,
      };
    },
  );
  const strongestEvidence = skills
    .filter((s) => s.requirementType === "required")
    .concat(skills.filter((s) => s.requirementType !== "required"))
    .flatMap((s) => s.evidence.slice(0, 1))
    .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
    .slice(0, 4);
  return {
    candidate: {
      id: candidate.id,
      name,
      filename: candidate.resume_filename,
      rank: candidate.rank,
      finalScore: candidate.final_score,
      semanticScore: candidate.semantic_score,
      keywordScore: candidate.keyword_score,
      coverageScore: candidate.skill_score,
    },
    skills,
    strongestEvidence,
    indexedChunkCount: ownChunks.length,
    documents: ownDocuments.map((d) => ({
      id: d.id,
      filename: d.filename,
      status: d.status,
    })),
  };
}
