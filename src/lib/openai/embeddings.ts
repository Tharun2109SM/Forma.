import "server-only";

import { getOpenAIClient } from "@/lib/openai/client";

export const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 64;

export async function embedText(input: string) {
  const [embedding] = await embedTexts([input]);
  if (!embedding) throw new Error("The embedding provider returned no result.");
  return embedding;
}

export async function embedTexts(
  inputs: string[],
  model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
) {
  if (inputs.length === 0) return [];
  const embeddings: number[][] = [];

  for (let offset = 0; offset < inputs.length; offset += EMBEDDING_BATCH_SIZE) {
    const response = await getOpenAIClient().embeddings.create({
      model,
      input: inputs.slice(offset, offset + EMBEDDING_BATCH_SIZE),
      encoding_format: "float",
      dimensions: EMBEDDING_DIMENSIONS,
    });
    embeddings.push(
      ...response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding),
    );
  }

  if (embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error(
      `OPENAI_EMBEDDING_MODEL must support ${EMBEDDING_DIMENSIONS}-dimension output.`,
    );
  }

  return embeddings;
}
