import "server-only";

import { v1 as vision } from "@google-cloud/vision";
import type { OCRInput, OCRProvider, OCRResult } from "@/lib/ocr/types";

const PAGES_PER_REQUEST = 5;

function credentials() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const raw = process.env.GOOGLE_CLOUD_VISION_CREDENTIALS;
  if (!projectId || !raw) throw new Error("Google Cloud Vision is not configured.");

  try {
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    return { projectId, credentials: JSON.parse(decoded) as Record<string, string> };
  } catch {
    throw new Error(
      "GOOGLE_CLOUD_VISION_CREDENTIALS must be service-account JSON or base64 JSON.",
    );
  }
}

function pageGroups(pageCount?: number | null) {
  if (!pageCount) return [undefined];
  const groups: number[][] = [];
  for (let page = 1; page <= pageCount; page += PAGES_PER_REQUEST) {
    groups.push(
      Array.from(
        { length: Math.min(PAGES_PER_REQUEST, pageCount - page + 1) },
        (_, index) => page + index,
      ),
    );
  }
  return groups;
}

export class GoogleVisionOCRProvider implements OCRProvider {
  async extractText({ pdf, pageCount }: OCRInput): Promise<OCRResult> {
    const client = new vision.ImageAnnotatorClient(credentials());
    const pageTexts: string[] = [];
    const confidences: number[] = [];
    const warnings: string[] = [];

    try {
      for (const pages of pageGroups(pageCount)) {
        const [result] = await client.batchAnnotateFiles({
          requests: [
            {
              inputConfig: { mimeType: "application/pdf", content: pdf },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              pages,
            },
          ],
        });
        const responses = result.responses?.[0]?.responses ?? [];
        for (const response of responses) {
          if (response.error?.message) warnings.push(response.error.message);
          pageTexts.push(response.fullTextAnnotation?.text?.trim() ?? "");
          for (const page of response.fullTextAnnotation?.pages ?? []) {
            for (const block of page.blocks ?? []) {
              if (typeof block.confidence === "number") confidences.push(block.confidence);
            }
          }
        }
      }
    } finally {
      await client.close();
    }

    const text = pageTexts.join("\n\n").trim();
    if (!text) throw new Error(warnings[0] ?? "Google Cloud Vision returned no text.");

    return {
      text,
      pageTexts,
      provider: "GOOGLE_CLOUD_VISION",
      confidence: confidences.length
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : undefined,
      pages: pageTexts.length,
      warnings: warnings.length ? warnings : undefined,
    };
  }
}
