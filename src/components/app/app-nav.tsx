"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Command, FileStack, Files, LayoutGrid, LogOut, Menu, Plus, Search, Settings2, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Viewer } from "@/lib/supabase/viewer";
import { signOutAction } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";

const primary = [
  { href: "/app", label: "Overview", icon: LayoutGrid },
  { href: "/app/analyses", label: "Analyses", icon: FileStack },
  { href: "/app/candidates", label: "Candidates", icon: UsersRound },
  { href: "/app/documents", label: "Documents", icon: Files },
] as const;

const shortcuts = [
  { href: "/app/analyses/new", label: "New analysis", icon: Plus },
  ...primary,
  { href: "/app/settings/profile", label: "Settings", icon: Settings2 },
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function RailContents({ viewer, onNavigate }: { viewer: Viewer; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="saas-rail-top">
        <Link className="saas-mark" href="/app" onClick={onNavigate} aria-label="Forma workspace overview">Forma<span>.</span></Link>
        <div className="saas-workspace-identity" aria-label="Current workspace">
          <span className="saas-workspace-glyph" aria-hidden="true">F</span>
          <span><strong>Personal workspace</strong><small>{viewer.isDemo ? "Sample environment" : "Your workspace"}</small></span>
        </div>
        <Link aria-label="New analysis" className="saas-create" href="/app/analyses/new" onClick={onNavigate}><Plus size={16} strokeWidth={1.8} aria-hidden="true" /> New analysis</Link>
      </div>

      <nav className="saas-primary-nav" aria-label="Workspace navigation">
        <span className="saas-nav-caption">WORKSPACE / 01</span>
        {primary.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return <Link aria-current={active ? "page" : undefined} aria-label={label} className={active ? "is-active" : ""} href={href} key={href} onClick={onNavigate}><Icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </nav>

      <div className="saas-rail-bottom">
        <div className="saas-rail-utility">
          <Link aria-label="Settings" className={pathname.startsWith("/app/settings") ? "is-active" : ""} href="/app/settings/profile" onClick={onNavigate}><Settings2 size={16} strokeWidth={1.7} aria-hidden="true" /> Settings</Link>
          <ThemeToggle compact />
        </div>
        <div className="saas-user">
          <span className="saas-avatar" aria-hidden="true">{initials(viewer.fullName)}</span>
          <span className="saas-user-copy"><strong>{viewer.fullName}</strong><small>{viewer.email}</small></span>
          <form action={signOutAction}><button type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} strokeWidth={1.7} /></button></form>
        </div>
      </div>
    </>
  );
}

export function AppNav({ viewer }: { viewer: Viewer }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredShortcuts = shortcuts.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <aside className="saas-sidebar"><RailContents viewer={viewer} /></aside>
      <header className="saas-mobile-bar">
        <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
        <Link className="saas-mark" href="/app">Forma<span>.</span></Link>
        <Link href="/app/analyses/new" aria-label="New analysis"><Plus size={20} /></Link>
      </header>
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="saas-modal-overlay" />
          <Dialog.Content className="saas-mobile-sheet" aria-describedby={undefined}>
            <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
            <Dialog.Close className="saas-sheet-close" aria-label="Close navigation"><X size={20} /></Dialog.Close>
            <RailContents viewer={viewer} onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <button className="saas-command-trigger" type="button" onClick={() => setCommandOpen(true)} aria-label="Open command menu"><Search size={15} aria-hidden="true" /><span>Search and navigate</span><kbd><Command size={11} /> K</kbd></button>
      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="saas-modal-overlay" />
          <Dialog.Content className="saas-command-dialog" aria-describedby="saas-command-help">
            <Dialog.Title className="sr-only">Quick navigation</Dialog.Title>
            <div className="saas-command-input"><Search size={19} aria-hidden="true" /><input autoFocus aria-label="Search actions" placeholder="Where do you want to go?" value={query} onChange={(event) => setQuery(event.target.value)} /><Dialog.Close aria-label="Close command menu"><X size={18} /></Dialog.Close></div>
            <p id="saas-command-help">QUICK ACTIONS</p>
            <nav aria-label="Quick actions">{filteredShortcuts.length ? filteredShortcuts.map(({ href, label, icon: Icon }) => <Link href={href} key={`${href}-${label}`} onClick={() => { setCommandOpen(false); setQuery(""); }}><Icon size={17} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={15} aria-hidden="true" /></Link>) : <span className="saas-command-empty">No matching actions.</span>}</nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
