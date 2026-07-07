"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export function SidebarNav({
  sections,
  brand,
  brandHref,
}: {
  sections: NavSection[];
  brand: string;
  brandHref: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b px-4 py-4">
        <Link href={brandHref} className="text-lg font-bold tracking-tight">
          {brand}
        </Link>
      </div>
      <nav
        aria-label="Huvudnavigation"
        className="flex-1 space-y-4 overflow-y-auto px-2 py-4"
      >
        {sections.map((section, i) => (
          <div key={section.title ?? i}>
            {section.title ? (
              <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {section.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
