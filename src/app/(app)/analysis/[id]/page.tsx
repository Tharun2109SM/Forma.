import { redirect } from "next/navigation";
import { redirectQuery, type AppSearchParams } from "@/lib/data/app-route-params";

export default async function LegacyAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AppSearchParams;
}) {
  const { id } = await params;
  redirect(`/app/analyses/${encodeURIComponent(id)}${redirectQuery(await searchParams)}`);
}
