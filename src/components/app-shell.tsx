"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Mic, FileDown, Settings, Menu } from "lucide-react";
import React from "react";

const navItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/sprechen", label: "Sprechen", Icon: Mic },
  { href: "/export", label: "Export", Icon: FileDown },
  { href: "/einstellungen", label: "Einstellungen", Icon: Settings },
] as const;

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--divider)] safe-area-pb"
    >
      <div className="mx-auto max-w-md grid grid-cols-4">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                "min-h-14 py-2 px-1 flex flex-col items-center justify-center gap-1",
                "text-[0.8125rem] leading-none",
                active
                  ? "text-[var(--accent)] font-semibold"
                  : "text-[var(--muted)] font-medium",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--divider)]">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">Tracker</div>
          <button
            type="button"
            aria-label="Menü"
            className="flex items-center justify-center rounded-[var(--radius)] text-[var(--foreground)] hover:bg-[var(--card)]"
            style={{ minHeight: "var(--tap-min)", minWidth: "var(--tap-min)" }}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-2 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}
