import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CandidateLibrary } from "@/components/app/candidate-library";
import { getAppAnalysisOptions, getAppCandidates, type CandidateFilters } from "@/lib/data/app-library";
import { firstParam, pageParam, type AppSearchParams } from "@/lib/data/app-route-params";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage({ searchParams }: { searchParams: AppSearchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const params = await searchParams;
  const search = firstParam(params.search);
  const analysisId = firstParam(params.analysis);
  const skill = firstParam(params.skill);
  const sort: NonNullable<CandidateFilters["sort"]> = firstParam(params.sort) === "score" ? "score" : "newest";
  const page = pageParam(params.page);
  const [result, analyses] = await Promise.all([
    getAppCandidates(viewer, { page: 1, pageSize: 500 }),
    getAppAnalysisOptions(viewer),
  ]);

  return (
    <main className="saas-page saas-candidates-page">
      <header className="saas-page-head">
        <div>
          <span className="saas-eyebrow">LIBRARY / CANDIDATES</span>
          <h1>Candidates</h1>
          <p>Search and inspect candidates across your analyses.</p>
        </div>
        <Link className="primary-action" href="/app/analyses/new">New analysis</Link>
      </header>
      <CandidateLibrary
        items={result.items}
        analyses={analyses}
        totalAvailable={result.total}
        isSample={result.isSample}
        initialSearch={search}
        initialAnalysisId={analysisId}
        initialSkill={skill}
        initialSort={sort}
        initialPage={page}
      />
    </main>
  );
}
