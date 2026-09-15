import type { Viewer } from "@/lib/supabase/viewer";
import { AppNav } from "@/components/app/app-nav";
import "@/styles/saas-app.css";

export function AppShell({ children, viewer }: { children: React.ReactNode; viewer: Viewer }) {
  return (
    <div className="saas-shell">
      <AppNav viewer={viewer} />
      <div className="saas-content">
        {viewer.isDemo && <div className="saas-demo-banner" role="note">SAMPLE WORKSPACE <span>Preview data is illustrative. Connect Supabase to use your own analyses.</span></div>}
        {children}
      </div>
    </div>
  );
}
