import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { firstParam, type AppSearchParams } from "@/lib/data/app-route-params";
import { getViewer } from "@/lib/supabase/viewer";
import { updateProfile } from "./actions";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage({ searchParams }: { searchParams: AppSearchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const notice = firstParam((await searchParams).notice);
  const message = notice === "saved" ? "Your name was updated." :
    notice === "invalid" ? "Enter a name with 1 to 200 characters." :
    notice === "error" ? "Your name could not be saved. Try again." :
    notice === "sample" ? "Profile editing is unavailable in the sample workspace." : null;

  return <main className="saas-page saas-settings-page">
    <header className="saas-page-head"><div><span className="saas-eyebrow">SETTINGS / PROFILE</span><h1>Your profile</h1><p>The name and email associated with your Forma. account.</p></div></header>
    {message && <p className="saas-inline-note" role="status">{message}</p>}
    <section className="saas-settings-section" aria-labelledby="profile-details"><div className="saas-section-head"><div><span className="saas-eyebrow">ACCOUNT</span><h2 id="profile-details">Profile details</h2></div></div>
      <form action={updateProfile} className="saas-settings-form"><label><span>Full name</span><input name="fullName" defaultValue={viewer.fullName} maxLength={200} required disabled={viewer.isDemo} /></label><label><span>Email address</span><input value={viewer.email} readOnly aria-readonly="true" /></label><p>Email is managed by your sign-in identity.</p><button className="primary-action" type="submit" disabled={viewer.isDemo}>Save changes</button></form>
    </section>
  </main>;
}
