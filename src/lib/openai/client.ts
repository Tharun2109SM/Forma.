import "server-only";

import OpenAI from "openai";

let openAIClient: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI is not configured.");
  if (!openAIClient) openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}
