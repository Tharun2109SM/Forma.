function normalizedLines(page: string) {
  return page
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim());
}

function repeatedEdgeLines(pages: string[][]) {
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const visible = lines.filter(Boolean);
    const edges = new Set([...visible.slice(0, 2), ...visible.slice(-2)]);
    for (const line of edges) {
      if (line.length >= 3 && line.length <= 100) {
        counts.set(line, (counts.get(line) ?? 0) + 1);
      }
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  return new Set(
    [...counts].filter(([, count]) => count >= threshold).map(([line]) => line),
  );
}

export function normalizeExtractedPages(inputPages: string[]) {
  const pages = inputPages.map(normalizedLines);
  const repeated = pages.length > 1 ? repeatedEdgeLines(pages) : new Set<string>();

  return pages.map((lines) =>
    lines
      .filter((line) => !repeated.has(line))
      .join("\n")
      .replace(/([\p{L}]{2,})-\n(?=[\p{Ll}]{2,})/gu, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export function normalizeExtractedText(text: string) {
  return normalizeExtractedPages([text])[0] ?? "";
}
