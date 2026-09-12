import "server-only";

import { OpenAIVisionOCRProvider } from "@/lib/ocr/openai-vision";
import type { OCRInput, OCRResult } from "@/lib/ocr/types";

export async function extractTextWithOCR(input: OCRInput): Promise<OCRResult> {
  const provider = process.env.OCR_PROVIDER ?? "openai";
  if (provider !== "openai") {
    throw new Error(`Unsupported OCR_PROVIDER: ${provider}`);
  }
  return new OpenAIVisionOCRProvider().extractText(input);
}

export type { OCRInput, OCRResult } from "@/lib/ocr/types";
