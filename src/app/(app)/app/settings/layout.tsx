"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/app/settings/profile", label: "Profile" },
  { href: "/app/settings/workspace", label: "Workspace" },
  { href: "/app/settings/security", label: "Security" },
  { href: "/app/settings/billing", label: "Billing" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="saas-settings-shell">
    <nav className="saas-settings-nav" aria-label="Settings sections">
      {sections.map((section) => <Link aria-current={pathname === section.href ? "page" : undefined} key={section.href} href={section.href}>{section.label}</Link>)}
    </nav>
    {children}
  </div>;
}
