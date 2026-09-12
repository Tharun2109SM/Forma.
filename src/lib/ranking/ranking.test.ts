import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateHybridScore,
  cosineSimilarity,
  matchExplicitSkills,
  normalizeSkill,
  rankCandidates,
} from "@/lib/ranking";

test("normalizes common skill aliases", () => {
  assert.equal(normalizeSkill("ReactJS"), "react");
  assert.equal(normalizeSkill("Node"), "node.js");
  assert.equal(normalizeSkill("Postgres"), "postgresql");
});

test("explicit matching remains independent of semantic similarity", () => {
  const match = matchExplicitSkills(
    "Built ReactJS interfaces and Node APIs backed by Postgres.",
    ["React", "Node.js", "PostgreSQL", "Kubernetes"],
  );
  assert.deepEqual(match.matched, ["react", "node.js", "postgresql"]);
  assert.deepEqual(match.missing, ["kubernetes"]);
  assert.equal(match.score, 75);
});

test("computes cosine similarity safely", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([], []), 0);
});

test("combines independent signals with deterministic weights", () => {
  assert.equal(
    calculateHybridScore({ semanticScore: 94, keywordScore: 92, skillScore: 89 }),
    92.4,
  );
});

test("ranks every candidate deterministically", () => {
  const ranked = rankCandidates([
    {
      id: "candidate-b",
      semanticScore: 70,
      keywordScore: 90,
      skillScore: 80,
      matchedSkills: [],
      missingSkills: [],
    },
    {
      id: "candidate-a",
      semanticScore: 95,
      keywordScore: 90,
      skillScore: 80,
      matchedSkills: [],
      missingSkills: [],
    },
  ]);
  assert.deepEqual(
    ranked.map(({ id, rank }) => ({ id, rank })),
    [
      { id: "candidate-a", rank: 1 },
      { id: "candidate-b", rank: 2 },
    ],
  );
});
