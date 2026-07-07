import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { DecisionSupportDisclaimer } from "@/components/app/disclaimer";
import { StatusBadge } from "@/components/app/status-badge";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Omfattas vi?" };

export default async function ScopePage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [resultRes, authoritiesRes, registrationRes] = await Promise.all([
    admin
      .from("scope_results")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("tenant_supervisory_authorities")
      .select("authority_code, is_manual_override, supervisory_authorities(name_sv)")
      .eq("tenant_id", tenant.id),
    admin
      .from("registration_records")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const result = resultRes.data;

  type MatchedRule = {
    ruleCode: string;
    titleSv: string;
    legalReference: string | null;
    textSv: string;
  };

  return (
    <main className="p-8">
      <PageHeader
        title="Omfattas vi av NIS2 / cybersäkerhetslagen?"
        description="Resultat av omfattningsbedömningen med regelkällor och nästa steg."
      />
      <div className="mb-6">
        <DecisionSupportDisclaimer />
      </div>

      {!result ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm">
            Ingen bedömning är gjord ännu. Starta i{" "}
            <Link href="/app/onboarding" className="text-primary hover:underline">
              Kom igång
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                color={
                  result.likely_covered === "yes"
                    ? "green"
                    : result.likely_covered === "manual_review"
                      ? "purple"
                      : "gray"
                }
              >
                {result.likely_covered === "yes"
                  ? "Omfattas sannolikt"
                  : result.likely_covered === "manual_review"
                    ? "Manuell bedömning krävs"
                    : "Omfattas sannolikt inte"}
              </StatusBadge>
              {result.classification ? (
                <StatusBadge color="blue">
                  {result.classification === "essential"
                    ? "Väsentlig verksamhetsutövare"
                    : result.classification === "important"
                      ? "Viktig verksamhetsutövare"
                      : result.classification === "public"
                        ? "Offentlig förvaltning"
                        : "Manuell bedömning"}
                </StatusBadge>
              ) : null}
              <StatusBadge
                color={
                  result.confidence === "high"
                    ? "green"
                    : result.confidence === "medium"
                      ? "yellow"
                      : "red"
                }
              >
                Tillförlitlighet: {result.confidence === "high" ? "hög" : result.confidence === "medium" ? "medel" : "låg"}
              </StatusBadge>
            </div>

            {(result.manual_review_reasons as string[]).length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Kräver manuell granskning</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {(result.manual_review_reasons as string[]).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Visa regelkälla
              </summary>
              <ul className="mt-2 space-y-2 text-sm">
                {(result.matched_rules as MatchedRule[]).map((r) => (
                  <li key={r.ruleCode} className="rounded-lg border p-3">
                    <p className="font-medium">{r.titleSv}</p>
                    <p className="text-muted-foreground">{r.textSv}</p>
                    {r.legalReference ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {r.legalReference}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-2 text-sm font-semibold">Sektorer</h3>
              <div className="flex flex-wrap gap-1.5">
                {(result.sectors as string[]).map((s) => (
                  <StatusBadge key={s} color="blue">
                    {s}
                  </StatusBadge>
                ))}
              </div>
              <h3 className="mt-4 mb-2 text-sm font-semibold">Tillsynsmyndigheter</h3>
              <ul className="space-y-1 text-sm">
                {(authoritiesRes.data ?? []).length === 0 ? (
                  <li className="text-muted-foreground">Inga tilldelade ännu.</li>
                ) : (
                  (authoritiesRes.data ?? []).map((a) => (
                    <li key={a.authority_code}>
                      {(a.supervisory_authorities as unknown as { name_sv: string } | null)
                        ?.name_sv ?? a.authority_code}
                      {a.is_manual_override ? " (manuellt vald)" : ""}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-2 text-sm font-semibold">Aktiva regelpaket</h3>
              <div className="flex flex-wrap gap-1.5">
                {(result.active_rule_packages as string[]).map((p) => (
                  <StatusBadge key={p} color="green">
                    {p}
                  </StatusBadge>
                ))}
              </div>
              {(result.pending_rule_packages as string[]).length > 0 ? (
                <>
                  <h3 className="mt-4 mb-2 text-sm font-semibold">
                    Kommande / delvis stödda regelpaket
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.pending_rule_packages as string[]).map((p) => (
                      <StatusBadge key={p} color="yellow">
                        {p}
                      </StatusBadge>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="mt-3 text-sm">
                <Link href="/app/rules" className="text-primary hover:underline">
                  Visa regelprofil och täckningsstatus
                </Link>
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-6">
            <h3 className="mb-2 text-sm font-semibold">Nästa steg</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {(result.next_steps as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border bg-card p-6">
            <h3 className="mb-2 text-sm font-semibold">Registrering (MCFFS 2026:1)</h3>
            {registrationRes.data ? (
              <p className="text-sm">
                Status: <StatusBadge color="blue">{registrationRes.data.status}</StatusBadge>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingen registrering påbörjad. Registrering är aktiv från 2 februari 2026.
                Ändringar ska anmälas inom 14 dagar där det är relevant.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
