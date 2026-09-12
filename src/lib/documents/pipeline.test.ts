import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import { chunkDocument } from "@/lib/documents/chunk";
import { extractDocument } from "@/lib/documents/extraction";
import {
  canonicalMimeType,
  fileExtension,
  isSupportedDocument,
} from "@/lib/documents/formats";
import { normalizeExtractedPages } from "@/lib/documents/normalize";
import { evaluateExtractionQuality, shouldUseOCR } from "@/lib/documents/quality";
import { resumeKey } from "@/lib/r2/keys";
import {
  extractWeightedRequirements,
  matchWeightedRequirements,
  rankCandidates,
} from "@/lib/ranking";

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

test("format validation accepts PDF, DOCX, XML, and TXT while rejecting others", () => {
  for (const name of ["role.pdf", "role.docx", "role.xml", "role.txt"]) {
    assert.equal(isSupportedDocument({ name }), true);
    const extension = fileExtension(name);
    assert.ok(extension);
    assert.ok(canonicalMimeType(extension).length > 0);
  }
  assert.equal(isSupportedDocument({ name: "resume.pages" }), false);
  assert.equal(
    isSupportedDocument({ name: "resume.pdf", type: "application/javascript" }),
    false,
  );
});

test("DOCX paragraphs and tables, XML text, and UTF-8 TXT use native extraction", async () => {
  const fixtureRoot = path.resolve("test/fixtures/generated");
  const fixtures = [
    ["resume-table.docx", "Node.js"],
    ["resume-structured.xml", "Leena Thomas"],
    ["resume-plain.txt", "OMAR KHAN"],
  ] as const;
  for (const [filename, expected] of fixtures) {
    const bytes = await readFile(path.join(fixtureRoot, filename));
    const extracted = await extractDocument({
      bytes: new Uint8Array(bytes),
      filename,
    });
    assert.equal(extracted.extractionMethod, "NATIVE");
    assert.match(extracted.text, new RegExp(expected.replace(".", "\\."), "i"));
    assert.ok(extracted.charCount >= 40);
  }
});

test("XML rejects DTD/entity input before parsing and does not affect healthy files", async () => {
  const malicious = new TextEncoder().encode(
    '<!DOCTYPE resume [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><resume>&xxe;</resume>',
  );
  const healthy = new TextEncoder().encode(
    "<resume><name>Safe Candidate</name><skills>Node.js PostgreSQL Docker AWS</skills></resume>",
  );
  const results = await Promise.allSettled([
    extractDocument({ bytes: malicious, filename: "unsafe.xml" }),
    extractDocument({ bytes: healthy, filename: "safe.xml" }),
  ]);
  assert.equal(results[0]?.status, "rejected");
  assert.equal(results[1]?.status, "fulfilled");
});

test("duplicate filenames cannot collide because R2 keys use document IDs", () => {
  const first = resumeKey("user", "analysis", "document-a", "pdf");
  const second = resumeKey("user", "analysis", "document-b", "pdf");
  assert.notEqual(first, second);
  assert.match(first, /document-a\.pdf$/);
});

test("mixed-format extraction feeds deterministic ranking and common RAG chunks", async () => {
  const fixtureRoot = path.resolve("test/fixtures/generated");
  const [docxBytes, xmlBytes, txtBytes] = await Promise.all([
    readFile(path.join(fixtureRoot, "resume-table.docx")),
    readFile(path.join(fixtureRoot, "resume-structured.xml")),
    readFile(path.join(fixtureRoot, "resume-plain.txt")),
  ]);
  const extracted = await Promise.all([
    extractDocument({ bytes: docxBytes, filename: "resume-table.docx" }),
    extractDocument({ bytes: xmlBytes, filename: "resume-structured.xml" }),
    extractDocument({ bytes: txtBytes, filename: "resume-plain.txt" }),
  ]);
  const requirements = extractWeightedRequirements(
    "Required: Node.js, PostgreSQL, Docker, AWS.\nPreferred: Kubernetes.",
  );
  const ranked = rankCandidates(
    extracted.map((document, index) => {
      const explicit = matchWeightedRequirements(document.text, requirements);
      return {
        id: `candidate-${index}`,
        semanticScore: 80 - index,
        keywordScore: explicit.keywordScore,
        skillScore: explicit.requiredScore,
        matchedSkills: explicit.matched,
        missingSkills: explicit.missingRequired,
      };
    }),
  );
  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map((candidate) => candidate.rank), [1, 2, 3]);
  for (const document of extracted) {
    const chunks = chunkDocument(normalizeExtractedPages(document.pages), {
      pageNumbers: false,
    });
    assert.ok(chunks.length > 0);
    assert.ok(chunks.every((chunk) => chunk.pageNumber === null));
  }
});
