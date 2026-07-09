import { redirect } from "next/navigation";

import type { NavSection } from "@/components/app/sidebar-nav";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { checkAuthGate } from "@/lib/services/auth-policy";
import { getCurrentTenant } from "@/lib/services/current-tenant";

const sections: NavSection[] = [
  {
    items: [
      { href: "/app/overview", label: "Översikt" },
      { href: "/app/onboarding", label: "Kom igång" },
      { href: "/app/notifications", label: "Notiser" },
    ],
  },
  {
    title: "Omfattning och regler",
    items: [
      { href: "/app/scope", label: "Omfattas vi?" },
      { href: "/app/rules", label: "Regelprofil" },
    ],
  },
  {
    title: "Verksamhet",
    items: [
      { href: "/app/systems", label: "System" },
      { href: "/app/critical-services", label: "Kritiska tjänster" },
      { href: "/app/vendors", label: "Leverantörer" },
    ],
  },
  {
    title: "Readiness",
    items: [
      { href: "/app/controls", label: "Kontroller" },
      { href: "/app/risks", label: "Risker" },
      { href: "/app/exercises", label: "Övningar" },
    ],
  },
  {
    title: "Incidenter",
    items: [
      { href: "/app/incidents", label: "Incidenter" },
      { href: "/app/reports", label: "Rapporter" },
      { href: "/app/evidence", label: "Bevisbank" },
      { href: "/app/lathunds", label: "Lathundar" },
    ],
  },
  {
    title: "Ledning och styrning",
    items: [
      { href: "/app/management", label: "Ledningsvy" },
      { href: "/app/procurement", label: "Upphandlingspaket" },
      { href: "/app/privacy", label: "Dataskydd" },
      { href: "/app/access-review", label: "Åtkomstgranskning" },
      { href: "/app/export-exit", label: "Export och exit" },
      { href: "/app/settings", label: "Inställningar" },
    ],
  },
];

export default async function TenantAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fail-closed enforcement of tenant auth requirements (SSO/MFA) on every
  // tenant page load. Blocked sessions are sent to an explanation page.
  const current = await getCurrentTenant();
  if (current) {
    const gate = await checkAuthGate(current.tenant.id);
    if (gate.blocked) redirect(`/auth-blocked?reason=${gate.reason}`);
  }

  return (
    <div className="flex min-h-screen">
      <SidebarNav sections={sections} brand="Säkerhetsklar" brandHref="/app/overview" />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
