const TARGET_CHARACTERS = 2_800;
const OVERLAP_CHARACTERS = 420;
const HEADING_PATTERN = /^(skills?|experience|work experience|employment|projects?|education|certifications?|summary|profile|requirements?|responsibilities|qualifications?)\s*:?[\s]*$/i;

export type DocumentChunk = {
  chunkIndex: number;
  pageNumber: number | null;
  sectionLabel: string | null;
  content: string;
  tokenCount: number;
};

function approximateTokenCount(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function splitLongText(text: string) {
  if (text.length <= TARGET_CHARACTERS) return [text];
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + TARGET_CHARACTERS, text.length);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf("; ", end),
      );
      if (boundary > start + TARGET_CHARACTERS * 0.65) end = boundary + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - OVERLAP_CHARACTERS);
  }
  return chunks;
}

export function chunkDocument(
  pages: string[],
  options: { pageNumbers?: boolean } = {},
): DocumentChunk[] {
  const output: DocumentChunk[] = [];
  let sectionLabel: string | null = null;

  pages.forEach((page, pageIndex) => {
    const segments: Array<{ content: string; sectionLabel: string | null }> = [];
    let buffer = "";

    function flush() {
      if (buffer.trim()) {
        segments.push({ content: buffer.trim(), sectionLabel });
        buffer = "";
      }
    }

    for (const line of page.split("\n")) {
      if (HEADING_PATTERN.test(line.trim())) {
        flush();
        sectionLabel = line.trim().replace(/:$/, "").toUpperCase();
        continue;
      }
      buffer += `${buffer ? "\n" : ""}${line}`;
    }
    flush();

    for (const segment of segments) {
      for (const content of splitLongText(segment.content)) {
        output.push({
          chunkIndex: output.length,
          pageNumber: options.pageNumbers === false ? null : pageIndex + 1,
          sectionLabel: segment.sectionLabel,
          content,
          tokenCount: approximateTokenCount(content),
        });
      }
    }
  });

  return output;
}
