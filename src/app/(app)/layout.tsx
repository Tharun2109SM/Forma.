import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getViewer } from "@/lib/supabase/viewer";

export default async function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/login");
  }

  return <AppShell viewer={viewer}>{children}</AppShell>;
}
