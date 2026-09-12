import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import { chunkDocument } from "@/lib/documents/chunk";
import { normalizeExtractedPages } from "@/lib/documents/normalize";
import { evaluateExtractionQuality, shouldUseOCR } from "@/lib/documents/quality";

const healthyResume = `ARJUN SHARMA
SUMMARY
Backend engineer with six years of production delivery.
SKILLS
Node.js, PostgreSQL, C++, C#, .NET, ASP.NET, React.js, Next.js
EXPERIENCE
Built REST APIs and deployed services on AWS using Docker and Kubernetes.
Designed resilient data access layers and monitored production systems.`;

test("healthy native resume text does not trigger OCR", () => {
  assert.equal(shouldUseOCR({ extractedText: healthyResume, pageCount: 1 }), false);
  assert.equal(evaluateExtractionQuality(healthyResume, 1).acceptable, true);
});

test("empty, implausibly short, and garbage extraction trigger OCR", () => {
  assert.equal(shouldUseOCR({ extractedText: "", pageCount: 2 }), true);
  assert.equal(shouldUseOCR({ extractedText: "John Doe", pageCount: 3 }), true);
  assert.equal(shouldUseOCR({ extractedText: "���▓▓▓%%%///", pageCount: 1 }), true);
  assert.equal(shouldUseOCR({ extractionError: new Error("parser failed") }), true);
});

test("normalization preserves technical tokens and removes repeated page edges", () => {
  const pages = normalizeExtractedPages([
    `FORMA TEST FIXTURE\nC++ C# .NET Node.js React.js Next.js PostgreSQL ASP.NET\nBuilt a plat-\nform service.\nCONFIDENTIAL`,
    `FORMA TEST FIXTURE\nBuilt services with Node.js and PostgreSQL.\nCONFIDENTIAL`,
  ]);
  const text = pages.join("\n");
  for (const token of ["C++", "C#", ".NET", "Node.js", "React.js", "Next.js", "PostgreSQL", "ASP.NET"]) {
    assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(text, /FORMA TEST FIXTURE/);
  assert.doesNotMatch(text, /Confidential/);
  assert.match(text, /platform service/i);
});

test("chunking keeps provenance, moderate sizes, and stable unique indexes", () => {
  const longExperience = Array.from(
    { length: 120 },
    (_, index) => `Built production API ${index} with Node.js, PostgreSQL, Docker, and AWS.`,
  ).join("\n");
  const chunks = chunkDocument([`SKILLS\nNode.js PostgreSQL\nEXPERIENCE\n${longExperience}`]);
  assert.ok(chunks.length > 1);
  assert.deepEqual(chunks.map((chunk) => chunk.chunkIndex), chunks.map((_, index) => index));
  assert.ok(chunks.every((chunk) => chunk.pageNumber === 1));
  assert.ok(chunks.every((chunk) => chunk.content.length <= 2_900));
  assert.ok(chunks.every((chunk) => chunk.tokenCount > 0));
});

test("synthetic native PDF extracts text while scanned PDF triggers OCR", async () => {
  const fixtureRoot = path.resolve("test/fixtures/generated");
  const nativeBytes = await readFile(path.join(fixtureRoot, "resume-perfect-match.pdf"));
  const nativePdf = await getDocumentProxy(new Uint8Array(nativeBytes));
  const native = await extractText(nativePdf, { mergePages: true });
  assert.equal(typeof native.text, "string");
  assert.match(native.text as string, /Node\.js/);
  assert.equal(
    shouldUseOCR({ extractedText: native.text as string, pageCount: native.totalPages }),
    false,
  );

  const scannedBytes = await readFile(path.join(fixtureRoot, "resume-scanned-image.pdf"));
  const scannedPdf = await getDocumentProxy(new Uint8Array(scannedBytes));
  const scanned = await extractText(scannedPdf, { mergePages: true });
  assert.equal(
    shouldUseOCR({ extractedText: scanned.text as string, pageCount: scanned.totalPages }),
    true,
  );
});
