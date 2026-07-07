import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { getCurrentTenant } from "@/lib/services/current-tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upphandlingspaket" };

const contents = [
  "Ansvarsmatris per driftmodell (A/B/C)",
  "Säkerhetsbilaga (arkitektur, åtkomst, loggning, kryptering)",
  "PUB-/DPA-bilaga (personuppgiftsbiträdesavtal, mall)",
  "Underbiträdesregister + kundspecifik leverantörsbilaga",
  "Dataresidens och tredjelandsöverföringsbedömning",
  "Supportåtkomst- och break-glass-process",
  "Anomalidetektering och åtkomstgranskning",
  "Backup-/restore-ansvar och runbooks",
  "Exitprocess, export och radering",
  "Retentionpolicy",
  "Tillgänglighetsredogörelse (mall)",
];

export default async function ProcurementPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  return (
    <main className="p-8">
      <PageHeader
        title="Upphandlingspaket"
        description="Generera ett komplett upphandlings- och säkerhetspaket för er organisation, anpassat till er driftmodell."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Innehåll</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {contents.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Generera</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Paketet genereras som ZIP med markdown-dokument och en
            kundspecifik ansvarsmatris och leverantörsbilaga. Genereringen
            loggas.
          </p>
          <a
            href={`/api/v1/procurement?tenantId=${tenant.id}`}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ladda ner upphandlingspaket (ZIP)
          </a>
        </section>
      </div>
    </main>
  );
}
