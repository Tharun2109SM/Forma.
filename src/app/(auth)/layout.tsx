import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasSupabaseEnv } from "@/lib/env";
import { getViewer } from "@/lib/supabase/viewer";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (hasSupabaseEnv()) {
    const viewer = await getViewer();
    if (viewer) redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <header className="auth-header">
        <Link className="wordmark" href="/" aria-label="Forma home">
          Forma<span>.</span>
        </Link>
        <ThemeToggle compact />
      </header>
      {children}
      <footer className="auth-footer">
        <span>FORMA / CANDIDATE INTELLIGENCE</span>
        <Link href="/">Back to product</Link>
      </footer>
    </main>
  );
}
