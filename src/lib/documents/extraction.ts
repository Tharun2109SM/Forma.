import { XMLParser, XMLValidator } from "fast-xml-parser";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import {
  fileExtension,
  type SupportedDocumentExtension,
} from "@/lib/documents/formats";
import { evaluateExtractionQuality, shouldUseOCR } from "@/lib/documents/quality";

export type ExtractionMethod = "NATIVE" | "OCR";

export type ExtractedDocument = {
  text: string;
  pages: string[];
  extractionMethod: ExtractionMethod;
  pageCount?: number;
  charCount: number;
  warnings?: string[];
  error?: string;
};

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

async function extractPdf(
  bytes: Uint8Array,
  onOcrRequired?: () => void | Promise<void>,
): Promise<ExtractedDocument> {
  let native: ExtractedPdf | null = null;
  let extractionError: unknown;

  try {
    native = await extractPdfText(bytes);
  } catch (error) {
    extractionError = error;
  }

  if (
    shouldUseOCR({
      extractedText: native?.text,
      pageCount: native?.pageCount,
      extractionError,
    })
  ) {
    await onOcrRequired?.();
    const { extractTextWithOCR } = await import("@/lib/ocr");
    const ocr = await extractTextWithOCR({
      pdf: bytes,
      pageCount: native?.pageCount,
    });
    const quality = evaluateExtractionQuality(ocr.text, ocr.pages ?? native?.pageCount ?? 1);
    if (!quality.acceptable) {
      throw new Error(`OCR text quality failed: ${quality.reasons.join(" ")}`);
    }
    return {
      text: ocr.text,
      pages: ocr.pageTexts,
      extractionMethod: "OCR",
      pageCount: ocr.pages ?? native?.pageCount ?? ocr.pageTexts.length,
      charCount: ocr.text.length,
      warnings: [
        ...(extractionError ? ["Native PDF extraction failed before OCR."] : []),
        ...(ocr.warnings ?? []),
      ],
    };
  }

  const text = native?.text ?? "";
  return {
    text,
    pages: native?.pages ?? [text],
    extractionMethod: "NATIVE",
    pageCount: native?.pageCount,
    charCount: text.length,
  };
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const text = result.value.trim();
  return {
    text,
    pages: [text],
    extractionMethod: "NATIVE",
    charCount: text.length,
    warnings: result.messages.length
      ? result.messages.map((message) => message.message)
      : undefined,
  };
}

function collectXmlText(value: unknown, output: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectXmlText(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "#text" && typeof child === "string" && child.trim()) {
      output.push(child.trim());
    } else if (key !== ":@") {
      collectXmlText(child, output);
    }
  }
}

function extractXml(bytes: Uint8Array): ExtractedDocument {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(decoded)) {
    throw new Error("XML document types and entities are not supported.");
  }
  const validation = XMLValidator.validate(decoded, { allowBooleanAttributes: false });
  if (validation !== true) {
    throw new Error(`Invalid XML: ${validation.err.msg}`);
  }
  const parsed = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: true,
    processEntities: false,
    trimValues: false,
  }).parse(decoded) as unknown;
  const lines: string[] = [];
  collectXmlText(parsed, lines);
  const text = lines.join("\n").trim();
  return {
    text,
    pages: [text],
    extractionMethod: "NATIVE",
    charCount: text.length,
    warnings: decoded.includes("�")
      ? ["Invalid UTF-8 sequences were replaced while decoding XML."]
      : undefined,
  };
}

function extractTxt(bytes: Uint8Array): ExtractedDocument {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  return {
    text,
    pages: [text],
    extractionMethod: "NATIVE",
    charCount: text.length,
    warnings: text.includes("�")
      ? ["Invalid UTF-8 sequences were replaced while decoding text."]
      : undefined,
  };
}

export async function extractDocument({
  bytes,
  filename,
  extension,
  onOcrRequired,
}: {
  bytes: Uint8Array;
  filename: string;
  extension?: SupportedDocumentExtension | null;
  onOcrRequired?: () => void | Promise<void>;
}): Promise<ExtractedDocument> {
  const resolvedExtension = extension ?? fileExtension(filename);
  if (!resolvedExtension) throw new Error("Unsupported document format.");

  let result: ExtractedDocument;
  switch (resolvedExtension) {
    case "pdf":
      result = await extractPdf(bytes, onOcrRequired);
      break;
    case "docx":
      result = await extractDocx(bytes);
      break;
    case "xml":
      result = extractXml(bytes);
      break;
    case "txt":
      result = extractTxt(bytes);
      break;
  }

  const minimumCharacters = resolvedExtension === "pdf" ? undefined : 40;
  const quality = evaluateExtractionQuality(result.text, result.pageCount ?? 1, {
    minimumCharacters,
  });
  if (!quality.acceptable) {
    throw new Error(`Extracted text quality failed: ${quality.reasons.join(" ")}`);
  }
  return result;
}
