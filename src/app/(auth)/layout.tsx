import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { CoordinateMarker, FormaGrid, SignalLine } from "@/components/ui/forma-grid";
import { hasSupabaseEnv } from "@/lib/env";
import { getViewer } from "@/lib/supabase/viewer";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (hasSupabaseEnv()) {
    const viewer = await getViewer();
    if (viewer) redirect("/app");
  }

  return (
    <main className="auth-shell">
      <FormaGrid className="auth-grid" columns={12} rows={8} />
      <header className="auth-header">
        <Link className="wordmark" href="/" aria-label="Forma home">
          Forma<span>.</span>
        </Link>
        <ThemeToggle compact />
      </header>
      <aside className="auth-identity" aria-label="Forma product identity">
        <CoordinateMarker>X:01 / AUTH</CoordinateMarker>
        <p>Noise becomes structure.<br />Every rank keeps its evidence.</p>
        <SignalLine active><small>SECURE WORKSPACE</small></SignalLine>
      </aside>
      <div className="auth-content">{children}</div>
      <footer className="auth-footer">
        <span>FORMA / CANDIDATE INTELLIGENCE</span>
        <Link href="/">Back to product</Link>
      </footer>
    </main>
  );
}
