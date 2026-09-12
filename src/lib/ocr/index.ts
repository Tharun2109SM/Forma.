import "server-only";

import { GoogleVisionOCRProvider } from "@/lib/ocr/google-vision";
import type { OCRInput, OCRResult } from "@/lib/ocr/types";

export async function extractTextWithOCR(input: OCRInput): Promise<OCRResult> {
  const provider = process.env.OCR_PROVIDER ?? "google-vision";
  if (provider !== "google-vision") {
    throw new Error(`Unsupported OCR_PROVIDER: ${provider}`);
  }
  return new GoogleVisionOCRProvider().extractText(input);
}

export type { OCRInput, OCRResult } from "@/lib/ocr/types";
