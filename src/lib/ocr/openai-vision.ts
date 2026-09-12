import "server-only";

import { getOpenAIClient } from "@/lib/openai/client";
import type { OCRInput, OCRProvider, OCRResult } from "@/lib/ocr/types";

const PAGE_MARKER = /<<<FORMA_PAGE_(\d+)>>>/g;

function parsePages(output: string) {
  const matches = [...output.matchAll(PAGE_MARKER)];
  if (matches.length === 0) return [output.trim()].filter(Boolean);

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? output.length;
      return output.slice(start, end).trim();
    })
    .filter(Boolean);
}

export class OpenAIVisionOCRProvider implements OCRProvider {
  async extractText({ pdf, pageCount }: OCRInput): Promise<OCRResult> {
    const model =
      process.env.OPENAI_RAG_MODEL ??
      process.env.OPENAI_EXPLANATION_MODEL ??
      "gpt-5-mini";
    const response = await getOpenAIClient().responses.create({
      model,
      store: false,
      max_output_tokens: 12_000,
      instructions: [
        "Transcribe the supplied scanned PDF exactly; do not summarize or infer missing text.",
        "Preserve headings, list items, table cell reading order, names, emails, dates, and technical punctuation.",
        "Begin every page with <<<FORMA_PAGE_N>>> where N is the one-based page number.",
        "Return only page markers and transcription text.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: pageCount
                ? `OCR all ${pageCount} pages of this document.`
                : "OCR every page of this document.",
            },
            {
              type: "input_file",
              filename: "document.pdf",
              file_data: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
    });

    const pageTexts = parsePages(response.output_text);
    const text = pageTexts.join("\n\n").trim();
    if (!text) throw new Error("OpenAI OCR returned no text.");

    return {
      text,
      pageTexts,
      provider: "OPENAI",
      pages: pageTexts.length,
      warnings:
        pageCount && pageTexts.length !== pageCount
          ? [`OCR returned ${pageTexts.length} page sections for a ${pageCount}-page PDF.`]
          : undefined,
    };
  }
}
