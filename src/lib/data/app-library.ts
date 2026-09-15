import "server-only";

import { demoCandidates } from "@/lib/data/demo-candidates";
import { getAnalyses, type AnalysisSummary } from "@/lib/data/analyses";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/supabase/viewer";
import type { AnalysisStatus, DocumentStatus, DocumentType } from "@/types/database";

const PAGE_SIZE = 24;

export type AppAnalysis = AnalysisSummary & { updatedAt: string };
export type LibraryPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  isSample: boolean;
};

export type AnalysisFilters = {
  page?: number;
  search?: string;
  status?: AnalysisStatus | "ALL";
  period?: "all" | "7d" | "30d" | "90d";
  sort?: "newest" | "oldest" | "updated";
};

export type LibraryCandidate = {
  id: string;
  analysisId: string;
  analysisTitle: string;
  jobTitle: string | null;
  companyName: string | null;
  name: string;
  email: string | null;
  resumeFilename: string;
  rank: number | null;
  finalScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  createdAt: string;
  isSample: boolean;
};

export type CandidateFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  analysisId?: string;
  skill?: string;
  sort?: "newest" | "score";
};

export type LibraryDocument = {
  id: string;
  analysisId: string;
  analysisTitle: string;
  documentType: DocumentType;
  filename: string;
  fileExtension: string;
  fileSize: number;
  status: DocumentStatus;
  extractionMethod: "NATIVE" | "OCR" | null;
  indexed: boolean;
  pageCount: number | null;
  createdAt: string;
  isSample: boolean;
};

export type DocumentFilters = {
  page?: number;
  search?: string;
  type?: DocumentType | "ALL";
  status?: DocumentStatus | "ALL";
};

export type AnalysisOption = { id: string; title: string };

function pageNumber(value: number | undefined) {
  return Number.isInteger(value) && value! > 0 ? Math.min(value!, 10_000) : 1;
}

function safeSearch(value: string | undefined) {
  return (value ?? "").trim().slice(0, 80).replace(/[^\p{L}\p{N} .@+-]/gu, "");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function uuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): LibraryPage<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    isSample: true,
  };
}

export async function getAppAnalyses(
  viewer: Viewer,
  filters: AnalysisFilters = {},
): Promise<LibraryPage<AppAnalysis>> {
  const page = pageNumber(filters.page);
  const search = safeSearch(filters.search);
  const status = filters.status && filters.status !== "ALL" ? filters.status : null;
  const days = filters.period === "7d" ? 7 : filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : null;
  const cutoff = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString() : null;
  const sort = filters.sort ?? "newest";

  if (viewer.isDemo) {
    let items: AppAnalysis[] = (await getAnalyses(viewer)).map((item) => ({
      ...item,
      updatedAt: item.createdAt,
    }));
    if (search) {
      const term = search.toLocaleLowerCase();
      items = items.filter((item) =>
        [item.title, item.jobTitle, item.companyName].some((value) =>
          value?.toLocaleLowerCase().includes(term),
        ),
      );
    }
    if (status) items = items.filter((item) => item.status === status);
    if (cutoff) items = items.filter((item) => item.createdAt >= cutoff);
    items.sort((a, b) =>
      sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : (sort === "updated" ? b.updatedAt : b.createdAt).localeCompare(
            sort === "updated" ? a.updatedAt : a.createdAt,
          ),
    );
    return paginate(items, page);
  }

  const supabase = await createClient();
  let query = supabase
    .from("analyses")
    .select("id,title,job_title,company_name,status,candidate_count,created_at,updated_at", {
      count: "exact",
    })
    .eq("user_id", viewer.id);
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,job_title.ilike.%${search}%,company_name.ilike.%${search}%`,
    );
  }
  if (status) query = query.eq("status", status);
  if (cutoff) query = query.gte("created_at", cutoff);
  const orderColumn = sort === "updated" ? "updated_at" : "created_at";
  const start = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query
    .order(orderColumn, { ascending: sort === "oldest" })
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw new Error("We could not load your analyses.");

  const ids = (rows ?? []).map((row) => row.id);
  const { data: topCandidates, error: topError } = ids.length
    ? await supabase
        .from("candidates")
        .select("analysis_id,name,final_score")
        .in("analysis_id", ids)
        .eq("rank", 1)
    : { data: [], error: null };
  if (topError) throw new Error("We could not load the top candidates.");
  const topByAnalysis = new Map((topCandidates ?? []).map((row) => [row.analysis_id, row]));

  return {
    items: (rows ?? []).map((row) => {
      const top = topByAnalysis.get(row.id);
      return {
        id: row.id,
        title: row.title,
        jobTitle: row.job_title,
        companyName: row.company_name,
        status: row.status,
        candidateCount: row.candidate_count,
        topCandidate: top?.name ?? null,
        topScore: top?.final_score ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isSample: false,
      };
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    isSample: false,
  };
}

export async function getAppOverview(viewer: Viewer) {
  const recent = await getAppAnalyses(viewer, { page: 1 });
  if (viewer.isDemo) {
    return {
      recent: recent.items.slice(0, 5),
      totalAnalyses: recent.total,
      activeAnalyses: recent.items.filter((item) =>
        ["UPLOADING", "PROCESSING"].includes(item.status),
      ).length,
      indexedDocuments: 0,
      isSample: true,
    };
  }

  const supabase = await createClient();
  const [analyses, active, documents] = await Promise.all([
    supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", viewer.id),
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .in("status", ["UPLOADING", "PROCESSING"]),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .eq("status", "READY"),
  ]);
  if (analyses.error || active.error || documents.error) {
    throw new Error("We could not load your workspace activity.");
  }
  return {
    recent: recent.items.slice(0, 5),
    totalAnalyses: analyses.count ?? 0,
    activeAnalyses: active.count ?? 0,
    indexedDocuments: documents.count ?? 0,
    isSample: false,
  };
}

export async function getAppAnalysisOptions(viewer: Viewer): Promise<AnalysisOption[]> {
  if (viewer.isDemo) {
    return [{ id: "demo", title: "Frontend Engineer shortlist" }];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id,title")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("We could not load the analysis filters.");
  return data ?? [];
}

export async function getAppCandidates(
  viewer: Viewer,
  filters: CandidateFilters = {},
): Promise<LibraryPage<LibraryCandidate>> {
  const page = pageNumber(filters.page);
  const pageSize = Number.isInteger(filters.pageSize)
    ? Math.min(Math.max(filters.pageSize!, 1), 500)
    : PAGE_SIZE;
  const search = safeSearch(filters.search);
  const skill = safeSearch(filters.skill);
  const analysisId = uuid(filters.analysisId);
  const invalidAnalysis = Boolean(filters.analysisId && !analysisId);
  if (viewer.isDemo) {
    let items: LibraryCandidate[] = demoCandidates.map((candidate) => ({
      id: candidate.id,
      analysisId: "demo",
      analysisTitle: "Frontend Engineer shortlist",
      jobTitle: "Senior Frontend Engineer",
      companyName: "Northstar Labs",
      name: candidate.name,
      email: candidate.email,
      resumeFilename: candidate.resumeFilename,
      rank: candidate.rank,
      finalScore: candidate.finalScore,
      matchedSkills: candidate.matchedSkills,
      missingSkills: candidate.missingSkills,
      createdAt: "2026-09-12T08:30:00.000Z",
      isSample: true,
    }));
    if (search) items = items.filter((item) =>
      [item.name, item.resumeFilename].some((value) =>
        value.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ),
    );
    if (skill) items = items.filter((item) =>
      item.matchedSkills.some((value) => value.toLocaleLowerCase() === skill.toLocaleLowerCase()),
    );
    if (analysisId || (invalidAnalysis && filters.analysisId !== "demo")) items = [];
    if (filters.sort === "score") items.sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
    return paginate(items, page, pageSize);
  }
  if (invalidAnalysis) return { items: [], total: 0, page, pageSize, isSample: false };

  const supabase = await createClient();
  let query = supabase
    .from("candidates")
    .select("id,analysis_id,name,email,resume_filename,rank,final_score,matched_skills,missing_skills,created_at", {
      count: "exact",
    });
  if (analysisId) query = query.eq("analysis_id", analysisId);
  if (search) query = query.or(`name.ilike.%${search}%,resume_filename.ilike.%${search}%`);
  if (skill) query = query.contains("matched_skills", [skill]);
  const start = (page - 1) * pageSize;
  const { data: rows, count, error } = await query
    .order(filters.sort === "score" ? "final_score" : "created_at", {
      ascending: false,
      nullsFirst: false,
    })
    .range(start, start + pageSize - 1);
  if (error) throw new Error("We could not load your candidates.");

  const ids = [...new Set((rows ?? []).map((row) => row.analysis_id))];
  const { data: analyses, error: analysesError } = ids.length
    ? await supabase
        .from("analyses")
        .select("id,title,job_title,company_name")
        .in("id", ids)
        .eq("user_id", viewer.id)
    : { data: [], error: null };
  if (analysesError) throw new Error("We could not load the candidate analyses.");
  const analysisById = new Map((analyses ?? []).map((item) => [item.id, item]));
  return {
    items: (rows ?? []).flatMap((row) => {
      const analysis = analysisById.get(row.analysis_id);
      if (!analysis) return [];
      return [{
        id: row.id,
        analysisId: row.analysis_id,
        analysisTitle: analysis.title,
        jobTitle: analysis.job_title,
        companyName: analysis.company_name,
        name: row.name ?? row.resume_filename.replace(/\.[^.]+$/i, ""),
        email: row.email,
        resumeFilename: row.resume_filename,
        rank: row.rank,
        finalScore: row.final_score,
        matchedSkills: stringArray(row.matched_skills),
        missingSkills: stringArray(row.missing_skills),
        createdAt: row.created_at,
        isSample: false,
      }];
    }),
    total: count ?? 0,
    page,
    pageSize,
    isSample: false,
  };
}

export async function getAppDocuments(
  viewer: Viewer,
  filters: DocumentFilters = {},
): Promise<LibraryPage<LibraryDocument>> {
  const page = pageNumber(filters.page);
  if (viewer.isDemo) return { items: [], total: 0, page, pageSize: PAGE_SIZE, isSample: true };

  const supabase = await createClient();
  const search = safeSearch(filters.search);
  let query = supabase
    .from("documents")
    .select("id,analysis_id,document_type,filename,file_extension,file_size,status,extraction_method,page_count,created_at", {
      count: "exact",
    })
    .eq("user_id", viewer.id);
  if (search) query = query.ilike("filename", `%${search}%`);
  if (filters.type && filters.type !== "ALL") query = query.eq("document_type", filters.type);
  if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
  const start = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw new Error("We could not load your documents.");

  const ids = [...new Set((rows ?? []).map((row) => row.analysis_id))];
  const { data: analyses, error: analysesError } = ids.length
    ? await supabase
        .from("analyses")
        .select("id,title")
        .in("id", ids)
        .eq("user_id", viewer.id)
    : { data: [], error: null };
  if (analysesError) throw new Error("We could not load the document analyses.");
  const analysisById = new Map((analyses ?? []).map((item) => [item.id, item.title]));
  return {
    items: (rows ?? []).flatMap((row) => {
      const analysisTitle = analysisById.get(row.analysis_id);
      if (!analysisTitle) return [];
      return [{
        id: row.id,
        analysisId: row.analysis_id,
        analysisTitle,
        documentType: row.document_type,
        filename: row.filename,
        fileExtension: row.file_extension,
        fileSize: row.file_size,
        status: row.status,
        extractionMethod: row.extraction_method,
        indexed: row.status === "READY",
        pageCount: row.page_count,
        createdAt: row.created_at,
        isSample: false,
      }];
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    isSample: false,
  };
}
