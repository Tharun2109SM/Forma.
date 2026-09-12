export function jobDescriptionKey(
  userId: string,
  analysisId: string,
  documentId: string,
) {
  return `users/${userId}/analyses/${analysisId}/jd/${documentId}.pdf`;
}

export function resumeKey(
  userId: string,
  analysisId: string,
  documentId: string,
) {
  return `users/${userId}/analyses/${analysisId}/resumes/${documentId}.pdf`;
}
