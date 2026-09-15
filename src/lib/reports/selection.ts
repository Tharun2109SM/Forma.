import { z } from "zod";
import { REPORT_TYPES, type ReportSelection } from "./types";

export class ReportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function parseReportSelection(params: URLSearchParams): ReportSelection {
  if ([...params.keys()].some((key) => !["type", "candidateIds"].includes(key)) ||
      params.getAll("type").length > 1 || params.getAll("candidateIds").length > 1)
    throw new ReportError("Invalid report options.", 400);
  const type = z.enum(REPORT_TYPES).safeParse(params.get("type") ?? "shortlist");
  if (!type.success) throw new ReportError("Unknown report type.", 400);
  const raw = params.get("candidateIds");
  const ids = raw ? raw.split(",") : [];
  if (!z.array(z.uuid()).max(4).safeParse(ids).success || new Set(ids).size !== ids.length)
    throw new ReportError("Invalid candidate selection.", 400);
  if ((type.data === "candidate" && ids.length !== 1) ||
      (type.data === "comparison" && (ids.length < 2 || ids.length > 4)) ||
      (!["candidate", "comparison"].includes(type.data) && raw !== null))
    throw new ReportError("Select the candidates required by this report.", 400);
  return { type: type.data, candidateIds: ids };
}

export function reportFilename(title: string, type: ReportSelection["type"]) {
  const slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "") || "analysis";
  const suffix = { shortlist: "shortlist", ranking: "ranking", "top-candidates": "top-candidates", candidate: "candidate-report", comparison: "comparison" }[type];
  return `forma-${slug}-${suffix}.pdf`;
}
