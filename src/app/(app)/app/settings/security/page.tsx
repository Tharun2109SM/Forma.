import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { getViewer } from "@/lib/supabase/viewer";

export const metadata: Metadata = { title: "Security settings" };

export default async function SecuritySettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return <main className="saas-page saas-settings-page">
    <header className="saas-page-head"><div><span className="saas-eyebrow">SETTINGS / SECURITY</span><h1>Security</h1><p>Review the authentication and data boundaries on your account.</p></div></header>
    <section className="saas-settings-section" aria-labelledby="security-details"><div className="saas-section-head"><div><span className="saas-eyebrow">ACCOUNT ACCESS</span><h2 id="security-details">Sign-in and data</h2></div></div><dl className="saas-settings-details"><div><dt>Sign-in</dt><dd>{viewer.isDemo ? "Sample workspace · no live session" : "Supabase email and password"}</dd></div><div><dt>Account email</dt><dd>{viewer.email}</dd></div><div><dt>Data access</dt><dd>Analyses and documents are scoped to the signed-in account.</dd></div></dl>{!viewer.isDemo && <form action={signOutAction}><button className="secondary-action" type="submit">Sign out</button></form>}</section>
  </main>;
}
