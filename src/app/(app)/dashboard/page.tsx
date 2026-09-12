import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getAnalyses } from "@/lib/data/analyses";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Shortlists" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const params = await searchParams;
  const analyses = viewer.isDemo && params.empty === "1" ? [] : await getAnalyses(viewer);

  return <DashboardView analyses={analyses} />;
}
