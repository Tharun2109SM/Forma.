import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import type { Viewer } from "@/lib/supabase/viewer";
import { signOutAction } from "@/app/(auth)/actions";
import { AppNav } from "@/components/app/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AppShell({
  children,
  viewer,
}: {
  children: React.ReactNode;
  viewer: Viewer;
}) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <Link className="wordmark" href="/dashboard" aria-label="Forma dashboard">
            Forma<span>.</span>
          </Link>
          <span className="header-divider" aria-hidden="true" />
          <AppNav />
        </div>
        <div className="app-header-right">
          {viewer.isDemo && <span className="demo-badge">SAMPLE WORKSPACE</span>}
          <ThemeToggle />
          <details className="user-menu">
            <summary aria-label="Open account menu">
              <span className="avatar">{initials(viewer.fullName)}</span>
              <span className="user-name">{viewer.fullName}</span>
              <ChevronDown aria-hidden="true" size={14} />
            </summary>
            <div className="user-popover">
              <div>
                <strong>{viewer.fullName}</strong>
                <span>{viewer.email}</span>
              </div>
              <form action={signOutAction}>
                <button type="submit">
                  <LogOut aria-hidden="true" size={14} /> Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <div className="app-content">{children}</div>
    </div>
  );
}
