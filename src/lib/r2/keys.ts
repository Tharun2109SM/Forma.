import type { SupportedDocumentExtension } from "@/lib/documents/formats";

export function jobDescriptionKey(
  userId: string,
  analysisId: string,
  documentId: string,
  extension: SupportedDocumentExtension,
) {
  return `users/${userId}/analyses/${analysisId}/jd/${documentId}.${extension}`;
}

export function resumeKey(
  userId: string,
  analysisId: string,
  documentId: string,
  extension: SupportedDocumentExtension,
) {
  return `users/${userId}/analyses/${analysisId}/resumes/${documentId}.${extension}`;
}
