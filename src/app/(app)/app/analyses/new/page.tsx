import type { Metadata } from "next";
import { NewAnalysisForm } from "@/components/analysis/new-analysis-form";
import { hasOpenAIEnv, hasR2Env, hasSupabaseEnv } from "@/lib/env";

export const metadata: Metadata = { title: "New analysis" };

export default function NewAnalysisPage() {
  return <main className="saas-page saas-new-analysis-page"><NewAnalysisForm demoMode={!hasSupabaseEnv() || !hasR2Env() || !hasOpenAIEnv()} /></main>;
}
