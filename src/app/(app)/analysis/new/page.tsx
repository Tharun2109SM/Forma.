import { redirect } from "next/navigation";
import { redirectQuery, type AppSearchParams } from "@/lib/data/app-route-params";

export default async function LegacyNewAnalysisPage({ searchParams }: { searchParams: AppSearchParams }) {
  redirect(`/app/analyses/new${redirectQuery(await searchParams)}`);
}
