import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export och exit" };

export default async function ExportExitPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const { data: packages } = await admin
    .from("audit_packages")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const exports = [
    {
      title: "Tillsynspaket (ZIP)",
      description:
        "Komplett paket för tillsyn: omfattning, regelprofil, kontroller, risker, system, tjänster, leverantörer, incidenter, rapporter, Cyberportalen-ID, beslut, sena rapporter, utbildningar och bevismanifest med hashar.",
      href: `/api/v1/exports?tenantId=${tenant.id}&type=supervisory-package`,
    },
    {
      title: "Styrelserapport (PDF)",
      description: "Sammanfattning, readiness, riskläge, incidenter och beslut som väntar.",
      href: `/api/v1/exports?tenantId=${tenant.id}&type=board-report&format=pdf`,
    },
    {
      title: "Styrelserapport (Word)",
      description: "Samma innehåll som PDF, redigerbar.",
      href: `/api/v1/exports?tenantId=${tenant.id}&type=board-report&format=docx`,
    },
    {
      title: "Systemregister (Excel)",
      description: "Alla system med ägare, RTO/RPO, backup och status.",
      href: `/api/v1/exports?tenantId=${tenant.id}&type=systems-excel`,
    },
    {
      title: "Leverantörsregister (Excel)",
      description: "Alla leverantörer med incidentkontakter, PUB-avtal och riskklass.",
      href: `/api/v1/exports?tenantId=${tenant.id}&type=vendors-excel`,
    },
    {
      title: "Exit-/exportpaket (ZIP)",
      description:
        "Fullständig dataexport för byte av leverantör eller avslut: samma innehåll som tillsynspaketet plus konfiguration. Er data är er egendom.",
      href: `/api/v1/exports?tenantId=${tenant.id}&type=supervisory-package`,
    },
  ];

  return (
    <main className="p-8">
      <PageHeader
        title="Export och exit"
        description="Generera paket för tillsyn, styrelse, upphandling och exit. Alla exporter loggas."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {exports.map((e) => (
          <a
            key={e.title}
            href={e.href}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40"
          >
            <p className="font-medium">{e.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
          </a>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Genererade paket</h2>
        <div className="rounded-xl border bg-card p-4 text-sm">
          {(packages ?? []).length === 0 ? (
            <p className="text-muted-foreground">Inga paket genererade ännu.</p>
          ) : (
            <ul className="space-y-1">
              {(packages ?? []).map((p) => (
                <li key={p.id}>
                  {p.package_type} — {new Date(p.created_at).toLocaleString("sv-SE")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
