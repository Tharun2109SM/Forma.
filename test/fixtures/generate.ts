import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const fixtureDirectory = path.resolve("test/fixtures/generated");

type Fixture = { filename: string; title: string; body: string };

const fixtures: Fixture[] = [
  {
    filename: "jd-backend-platform.pdf",
    title: "Senior Backend Platform Engineer",
    body: "Required: Node.js, PostgreSQL, REST APIs, Docker, AWS. Preferred: Kubernetes, React. Build reliable services and cloud deployments.",
  },
  { filename: "resume-perfect-match.pdf", title: "Aarav Mehta", body: "Six years building Node.js REST APIs with PostgreSQL, Docker, AWS, Kubernetes, and production observability." },
  { filename: "resume-semantic-match.pdf", title: "Diya Nair", body: "Designed server-side JavaScript services, relational data systems, containerized workloads, and public cloud delivery." },
  { filename: "resume-keyword-spam.pdf", title: "Kabir Rao", body: "Node.js Node.js Node.js PostgreSQL PostgreSQL Docker AWS. Coursework only; no production projects." },
  { filename: "resume-missing-required.pdf", title: "Meera Shah", body: "Frontend engineer with ReactJS and Next.js. Built design systems but no PostgreSQL experience." },
  { filename: "resume-react-alias.pdf", title: "Vihaan Singh", body: "ReactJS specialist who also built Node services and Postgres-backed REST endpoints." },
  { filename: "resume-node-alias.pdf", title: "Anaya Iyer", body: "Developed Node and Express APIs, PostgreSQL schemas, and Docker deployment automation." },
  { filename: "resume-unusual-headings.pdf", title: "Reyansh Das", body: "WHAT I BUILD\nCloud APIs on AWS.\nTOOLS I TRUST\nNode.js, PostgreSQL, Docker, Terraform." },
  { filename: "resume-missing-sections.pdf", title: "Ishita Bose", body: "Software developer. Node.js, REST, PostgreSQL. Built a volunteer scheduling API." },
  { filename: "resume-unrelated.pdf", title: "Arjun Kapoor", body: "Editorial illustrator focused on print campaigns, typography, and brand photography." },
  { filename: "resume-cloud-depth.pdf", title: "Sara Khan", body: "Owned AWS ECS and Kubernetes deployments for Node.js services with PostgreSQL, Docker, and incident response." },
];

function wrap(text: string, length = 82) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (`${line} ${word}`.trim().length > length) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

async function textPdf(fixture: Fixture) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  page.drawText(fixture.title, { x: 54, y: 720, size: 22, font: bold, color: rgb(0.06, 0.09, 0.16) });
  wrap(fixture.body).forEach((line, index) => {
    page.drawText(line, { x: 54, y: 674 - index * 20, size: 11, font, color: rgb(0.15, 0.18, 0.24) });
  });
  return pdf.save();
}

async function scannedPdf() {
  const svg = `<svg width="1200" height="1550" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="90" y="150" font-size="54" font-family="Arial" fill="#111827">NEIL FERNANDES</text>
    <text x="90" y="250" font-size="28" font-family="Arial" fill="#374151">SCANNED RESUME</text>
    <text x="90" y="330" font-size="25" font-family="Arial" fill="#111827">Built Node.js REST APIs with PostgreSQL and Docker.</text>
    <text x="90" y="380" font-size="25" font-family="Arial" fill="#111827">Deployed production workloads on AWS.</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([612, 792]);
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  return pdf.save();
}

async function main() {
  await mkdir(fixtureDirectory, { recursive: true });
  for (const fixture of fixtures) {
    await writeFile(path.join(fixtureDirectory, fixture.filename), await textPdf(fixture));
  }
  await writeFile(path.join(fixtureDirectory, "resume-scanned-image.pdf"), await scannedPdf());
  console.log(`Generated ${fixtures.length + 1} synthetic PDF fixtures in ${fixtureDirectory}`);
}

void main();
