"use client";

import Link from "next/link";
import { FileStack, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Shortlists", Icon: FileStack },
  { href: "/analysis/new", label: "New analysis", Icon: Plus },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Recruiter workspace">
      {items.map(({ href, label, Icon }) => {
        const active =
          pathname === href || (href === "/dashboard" && pathname.startsWith("/analysis/") && pathname !== "/analysis/new");
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "is-active" : ""}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
