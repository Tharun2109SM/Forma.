import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCandidateEvidence,
  findSkillTerm,
  classifySection,
  type EvidenceCandidate,
  type EvidenceDocument,
  type EvidenceChunk,
} from "./derive";
import {
  validateCandidateSelection,
  selectionBelongsToAnalysis,
} from "./selection";
import { loadCandidateEvidenceBatch, EvidenceError } from "./service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const analysisId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];
const candidate: EvidenceCandidate = {
  id: ids[0],
  analysis_id: analysisId,
  name: "Test Candidate",
  resume_filename: "test-resume.txt",
  resume_text: null,
  rank: 2,
  final_score: 71.2,
  semantic_score: 68,
  keyword_score: 72,
  skill_score: 78,
  matched_skills: ["React", "Node.js"],
  missing_skills: ["PostgreSQL"],
};
const doc: EvidenceDocument = {
  id: "doc-1",
  analysis_id: analysisId,
  candidate_id: ids[0],
  document_type: "RESUME",
  filename: "uploaded.txt",
  status: "READY",
  extracted_text: "React and Node.js",
};
const chunks: EvidenceChunk[] = [
  {
    id: "chunk-1",
    analysis_id: analysisId,
    candidate_id: ids[0],
    document_id: doc.id,
    document_type: "RESUME",
    content: "Built React dashboards with Node.js.",
    page_number: 2,
    section_label: "EXPERIENCE",
    chunk_index: 1,
  },
  {
    id: "chunk-2",
    analysis_id: analysisId,
    candidate_id: ids[0],
    document_id: doc.id,
    document_type: "RESUME",
    content: "ReactJS, NodeJS, TypeScript",
    page_number: 1,
    section_label: "SKILLS",
    chunk_index: 0,
  },
];
const jd = "Required\nReact\nNode.js\nPostgreSQL\nPreferred\nDocker";
test("exact and alias references are ordered deterministically and preserve source metadata", () => {
  const result = deriveCandidateEvidence(candidate, jd, [doc], chunks);
  const react = result.skills.find((s) => s.skill === "react")!;
  assert.equal(react.status, "EVIDENCED");
  assert.equal(react.evidence.length, 2);
  assert.equal(react.evidence[0].matchType, "DIRECT");
  assert.equal(react.evidence[1].matchType, "ALIASED");
  assert.equal(react.evidence[0].context, chunks[0].content);
  assert.equal(react.evidence[0].filename, "uploaded.txt");
  assert.equal(react.evidence[0].pageNumber, 2);
  assert.equal(react.evidence[0].section, "EXPERIENCE");
  assert.equal(react.evidence[0].documentId, doc.id);
  assert.equal(result.candidate.rank, candidate.rank);
  assert.equal(result.candidate.finalScore, candidate.final_score);
  assert.equal(result.candidate.coverageScore, candidate.skill_score);
});
test("absence is NOT_EVIDENCED; source context never promotes absent skills into rank matches", () => {
  const result = deriveCandidateEvidence(
    candidate,
    jd,
    [doc],
    [...chunks, { ...chunks[0], id: "pg", content: "PostgreSQL" }],
  );
  const pg = result.skills.find((s) => s.skill === "postgresql")!;
  assert.equal(pg.status, "NOT_EVIDENCED");
  assert.equal(pg.storedMatched, false);
  assert.deepEqual(pg.evidence, []);
  assert.equal(
    result.skills.find((s) => s.skill === "docker")?.requirementType,
    "preferred",
  );
});
test("boundary matching rejects substrings and accepts canonical aliases", () => {
  assert.equal(findSkillTerm("reactive service", "React"), null);
  assert.equal(findSkillTerm("Google cloud", "Go"), null);
  assert.equal(findSkillTerm("ReactJS project", "React")?.type, "ALIASED");
  assert.equal(
    findSkillTerm("postgres experience", "PostgreSQL")?.type,
    "ALIASED",
  );
  assert.equal(findSkillTerm("Node.js APIs", "Node.js")?.type, "DIRECT");
});
test("section classification is deterministic and unknown labels remain OTHER", () => {
  assert.equal(classifySection("PROJECTS"), "PROJECT");
  assert.equal(classifySection(null), "OTHER");
  assert.equal(classifySection("Professional certifications"), "CERTIFICATION");
});
test("unrelated candidates, documents and chunks cannot produce evidence", () => {
  const result = deriveCandidateEvidence(
    candidate,
    jd,
    [{ ...doc, analysis_id: ids[1] }],
    chunks,
  );
  assert.equal(result.indexedChunkCount, 0);
  assert.deepEqual(result.strongestEvidence, []);
  const foreign = deriveCandidateEvidence(
    candidate,
    jd,
    [{ ...doc, extracted_text: null }],
    [
      { ...chunks[0], analysis_id: ids[1] },
      { ...chunks[1], candidate_id: ids[1] },
    ],
  );
  assert.equal(foreign.indexedChunkCount, 0);
  assert.deepEqual(foreign.strongestEvidence, []);
});
test("unindexed native source fallback is real text with no fabricated page metadata", () => {
  const result = deriveCandidateEvidence(candidate, jd, [doc], []);
  const ref = result.skills[0].evidence[0];
  assert.equal(ref.origin, "EXTRACTED_TEXT");
  assert.equal(ref.pageNumber, null);
  assert.equal(ref.section, null);
  assert.match(ref.context, /React/);
});
for (const count of [2, 3, 4])
  test(`comparison validates ${count} selected candidates without changing rank`, () => {
    assert.deepEqual(
      validateCandidateSelection(ids.slice(0, count)),
      ids.slice(0, count),
    );
  });
test("reject one, five, duplicates, malformed IDs and cross-analysis selection", () => {
  for (const selection of [
    ids.slice(0, 1),
    ids,
    [ids[0], ids[0]],
    ["not-id", ids[0]],
  ])
    assert.throws(() => validateCandidateSelection(selection));
  assert.equal(
    selectionBelongsToAnalysis(
      ids.slice(0, 2),
      [
        { id: ids[0], analysis_id: analysisId },
        { id: ids[1], analysis_id: ids[2] },
      ],
      analysisId,
    ),
    false,
  );
});

function mockClient({
  user = true,
  owned = true,
  foreign = false,
  candidateIds = [ids[0]],
}: {
  user?: boolean;
  owned?: boolean;
  foreign?: boolean;
  candidateIds?: string[];
} = {}) {
  const queries: Array<{
    table: string;
    filters: Array<[string, unknown]>;
    range?: number[];
  }> = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: user ? { id: "owner" } : null },
        error: null,
      }),
    },
    from: (table: string) => {
      const query = {
        table,
        filters: [] as Array<[string, unknown]>,
        range: undefined as number[] | undefined,
      };
      queries.push(query);
      const value = () => ({
        error: null,
        data:
          table === "analyses"
            ? owned
              ? {
                  id: analysisId,
                  title: "Role",
                  jd_text: jd,
                  status: "COMPLETED",
                }
              : null
            : table === "candidates"
              ? candidateIds.map((id) => ({
                  ...candidate,
                  id,
                  analysis_id: foreign ? ids[1] : analysisId,
                }))
              : table === "documents"
                ? candidateIds.map((id) => ({
                    ...doc,
                    id: `doc-${id}`,
                    candidate_id: id,
                  }))
                : candidateIds.flatMap((id) =>
                    chunks.map((c) => ({
                      ...c,
                      id: `${c.id}-${id}`,
                      candidate_id: id,
                      document_id: `doc-${id}`,
                    })),
                  ),
      });
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          query.filters.push([key, value]);
          return builder;
        },
        in: (key: string, value: unknown) => {
          query.filters.push([key, value]);
          return builder;
        },
        order: () => builder,
        range: (start: number, end: number) => {
          query.range = [start, end];
          return builder;
        },
        maybeSingle: async () => value(),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve(value()).then(resolve),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, queries };
}
test("unauthenticated and unowned analysis requests stop before source queries", async () => {
  for (const options of [{ user: false }, { owned: false }]) {
    const mock = mockClient(options);
    await assert.rejects(
      loadCandidateEvidenceBatch(mock.client, analysisId, [ids[0]]),
      (e) => e instanceof EvidenceError && [401, 404].includes(e.status),
    );
    assert.equal(
      mock.queries.some((q) => q.table === "document_chunks"),
      false,
    );
  }
});
test("candidate from another analysis is rejected before documents or chunks are queried", async () => {
  const mock = mockClient({ foreign: true });
  await assert.rejects(
    loadCandidateEvidenceBatch(mock.client, analysisId, [ids[0]]),
    (e) => e instanceof EvidenceError && e.status === 404,
  );
  assert.equal(
    mock.queries.some((q) => q.table === "documents"),
    false,
  );
});
test("batch retrieval carries explicit ownership and analysis filters and never writes ranking", async () => {
  const mock = mockClient();
  const before = JSON.stringify(candidate);
  const result = await loadCandidateEvidenceBatch(mock.client, analysisId, [
    ids[0],
  ]);
  assert.equal(mock.queries.length, 4);
  assert.deepEqual(mock.queries[0].filters, [
    ["id", analysisId],
    ["user_id", "owner"],
  ]);
  for (const query of mock.queries.slice(1))
    assert.ok(
      query.filters.some(
        ([key, value]) => key === "analysis_id" && value === analysisId,
      ),
    );
  assert.equal(result.candidates[0].candidate.rank, 2);
  assert.equal(result.candidates[0].candidate.finalScore, 71.2);
  assert.equal(JSON.stringify(candidate), before);
});
for (const count of [2, 3, 4])
  test(`${count}-candidate evidence workspace uses one batch per table and preserves stored metrics`, async () => {
    const selected = ids.slice(0, count);
    const mock = mockClient({ candidateIds: selected });
    const result = await loadCandidateEvidenceBatch(
      mock.client,
      analysisId,
      selected,
    );
    assert.equal(mock.queries.length, 4);
    assert.equal(result.candidates.length, count);
    for (const row of result.candidates) {
      assert.equal(row.candidate.rank, candidate.rank);
      assert.equal(row.candidate.finalScore, candidate.final_score);
      assert.equal(row.indexedChunkCount, 2);
    }
  });
