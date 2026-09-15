import type { Metadata } from "next";

export const metadata: Metadata = { title: "Billing settings" };

export default function BillingSettingsPage() {
  return <main className="saas-page saas-settings-page">
    <header className="saas-page-head"><div><span className="saas-eyebrow">SETTINGS / BILLING</span><h1>Billing</h1><p>A clear place for commercial settings when billing becomes available.</p></div></header>
    <section className="saas-empty"><span className="saas-eyebrow">NOT CONFIGURED</span><h2>Billing is not configured.</h2><p>There is no subscription, payment method, or invoice attached to this workspace in Forma. today.</p></section>
  </main>;
}
