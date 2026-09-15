import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function WorkspaceSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return <main className="saas-page saas-settings-page">
    <header className="saas-page-head"><div><span className="saas-eyebrow">SETTINGS / WORKSPACE</span><h1>Workspace</h1><p>Your personal space for analyses, candidates, and documents.</p></div></header>
    <section className="saas-settings-section" aria-labelledby="workspace-details"><div className="saas-section-head"><div><span className="saas-eyebrow">CURRENT MODEL</span><h2 id="workspace-details">Personal workspace</h2></div></div><dl className="saas-settings-details"><div><dt>Owner</dt><dd>{viewer.fullName}</dd></div><div><dt>Account ID</dt><dd><code>{viewer.isDemo ? "Sample workspace" : viewer.id}</code></dd></div><div><dt>Team access</dt><dd>Not available yet</dd></div></dl><p className="saas-inline-note">Forma. currently keeps analyses private to one account. Team members and roles are not configured.</p></section>
  </main>;
}
