export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;

export const SUPPORTED_DOCUMENT_EXTENSIONS = ["pdf", "docx", "xml", "txt"] as const;

export type SupportedDocumentExtension =
  (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number];

const MIME_TYPES: Record<SupportedDocumentExtension, readonly string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  xml: ["application/xml", "text/xml"],
  txt: ["text/plain"],
};

export const DOCUMENT_ACCEPT = [
  ".pdf",
  ".docx",
  ".xml",
  ".txt",
  ...Object.values(MIME_TYPES).flat(),
].join(",");

export function fileExtension(filename: string): SupportedDocumentExtension | null {
  const extension = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return SUPPORTED_DOCUMENT_EXTENSIONS.find((value) => value === extension) ?? null;
}

export function canonicalMimeType(extension: SupportedDocumentExtension) {
  return MIME_TYPES[extension][0];
}

export function isSupportedDocument({
  name,
  type,
}: {
  name: string;
  type?: string | null;
}) {
  const extension = fileExtension(name);
  if (!extension) return false;
  if (!type || type === "application/octet-stream") return true;
  return MIME_TYPES[extension].includes(type.toLowerCase());
}

export function supportedFormatLabel() {
  return "PDF, DOCX, XML, or TXT";
}
