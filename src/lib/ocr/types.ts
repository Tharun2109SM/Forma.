export type OCRInput = {
  pdf: Uint8Array;
  pageCount?: number | null;
};

export type OCRResult = {
  text: string;
  pageTexts: string[];
  provider: string;
  confidence?: number;
  pages?: number;
  warnings?: string[];
};

export interface OCRProvider {
  extractText(input: OCRInput): Promise<OCRResult>;
}
