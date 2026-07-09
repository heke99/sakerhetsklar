import type { NavSection } from "@/components/app/sidebar-nav";
import { SidebarNav } from "@/components/app/sidebar-nav";

const sections: NavSection[] = [
  {
    items: [{ href: "/platform", label: "Dashboard" }],
  },
  {
    title: "Tenants",
    items: [
      { href: "/platform/tenants", label: "Tenants" },
      { href: "/platform/deployments", label: "Deployments" },
      { href: "/platform/release-status", label: "Release status" },
    ],
  },
  {
    title: "Rules",
    items: [
      { href: "/platform/rules", label: "Rule packages" },
      { href: "/platform/rule-versions", label: "Rule versions" },
      { href: "/platform/sectors", label: "Sectors" },
      { href: "/platform/authorities", label: "Authorities" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/platform/templates", label: "Report templates" },
      { href: "/platform/lathunds", label: "Lathunds" },
      { href: "/platform/procurement", label: "Procurement" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/platform/integrations", label: "Integrations" },
      { href: "/platform/billing", label: "Billing" },
      { href: "/platform/feature-flags", label: "Feature flags" },
      { href: "/platform/support-access", label: "Support access" },
      { href: "/platform/health", label: "Health" },
    ],
  },
  {
    title: "Security",
    items: [
      { href: "/platform/security", label: "Security" },
      { href: "/platform/audit", label: "Audit log" },
    ],
  },
];

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SidebarNav
        sections={sections}
        brand="Säkerhetsklar Platform"
        brandHref="/platform"
      />
      <div id="content" className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
