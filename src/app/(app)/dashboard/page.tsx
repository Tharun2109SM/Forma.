import { redirect } from "next/navigation";
import { redirectQuery, type AppSearchParams } from "@/lib/data/app-route-params";

export default async function LegacyDashboardPage({ searchParams }: { searchParams: AppSearchParams }) {
  redirect(`/app${redirectQuery(await searchParams)}`);
}
