export type ExtractionQuality = {
  acceptable: boolean;
  characterCount: number;
  alphanumericRatio: number;
  printableRatio: number;
  replacementRatio: number;
  reasons: string[];
};

export function evaluateExtractionQuality(
  extractedText: string,
  pageCount = 1,
  options: { minimumCharacters?: number } = {},
): ExtractionQuality {
  const text = extractedText.trim();
  const characterCount = text.length;
  const characters = Math.max(characterCount, 1);
  const alphanumericRatio = (text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) / characters;
  const printableRatio =
    (text.match(/[\p{L}\p{N}\p{P}\p{Z}\s]/gu)?.length ?? 0) / characters;
  const replacementRatio = (text.match(/�/g)?.length ?? 0) / characters;
  const reasons: string[] = [];
  const minimumCharacters =
    options.minimumCharacters ?? Math.max(120, pageCount * 80);

  if (characterCount === 0) reasons.push("No text was extracted.");
  else if (characterCount < minimumCharacters) {
    reasons.push("The extracted text is implausibly short for the page count.");
  }
  if (characterCount > 0 && alphanumericRatio < 0.42) {
    reasons.push("The extracted text contains too little readable language.");
  }
  if (characterCount > 0 && printableRatio < 0.92) {
    reasons.push("The extracted text contains too many non-printable characters.");
  }
  if (replacementRatio > 0.02) {
    reasons.push("The extracted text contains too many replacement characters.");
  }

  return {
    acceptable: reasons.length === 0,
    characterCount,
    alphanumericRatio,
    printableRatio,
    replacementRatio,
    reasons,
  };
}

export function shouldUseOCR({
  extractedText,
  pageCount,
  extractionError,
}: {
  extractedText?: string | null;
  pageCount?: number | null;
  extractionError?: unknown;
}) {
  if (extractionError) return true;
  return !evaluateExtractionQuality(extractedText ?? "", pageCount ?? 1).acceptable;
}
