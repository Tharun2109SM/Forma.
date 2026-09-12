import { cosineSimilarity } from "@/lib/ranking/cosine";

export function semanticScore(jobEmbedding: number[], resumeEmbedding: number[]) {
  const similarity = cosineSimilarity(jobEmbedding, resumeEmbedding);
  return Math.max(0, Math.min(100, similarity * 100));
}
