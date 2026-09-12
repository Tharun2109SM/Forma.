import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

export type ExtractedPdf = {
  text: string;
  pageCount: number;
  pages: string[];
};

export async function extractPdfText(input: Uint8Array): Promise<ExtractedPdf> {
  const pdf = await getDocumentProxy(input);
  const result = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(result.text) ? result.text : [result.text];

  return {
    text: pages.join("\n\n"),
    pageCount: result.totalPages,
    pages,
  };
}
