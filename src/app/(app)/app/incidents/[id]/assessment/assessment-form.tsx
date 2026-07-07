"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";

interface MatchedRule {
  ruleSetCode: string;
  ruleCode: string;
  titleSv: string;
  reasonSv: string;
  legalReference: string | null;
}

interface AssessmentRow {
  id: string;
  recommendation: string;
  confidence: string;
  reasons: string[];
  matched_rules: MatchedRule[];
  missing_facts: string[];
  next_steps: string[];
  legal_references: string[];
  rule_coverage_partial: boolean;
  also_assess_gdpr: boolean;
  also_assess_pts: boolean;
  also_assess_eidas: boolean;
  also_assess_contracts: boolean;
  also_assess_insurance: boolean;
  also_assess_state_agency: boolean;
  approval_status: string;
  deadline_definitions: {
    deadlineType: string;
    hoursFromSignificant?: number;
    daysFromNotification?: number;
    titleSv: string;
  }[];
}

const recommendationLabels: Record<string, string> = {
  not_reportable: "Ej rapporteringspliktig",
  monitor: "Bevaka",
  potentially_significant: "Potentiellt betydande",
  significant_reportable: "Betydande — rapporteringspliktig",
  manual_review_required: "Manuell bedömning krävs",
};

const recommendationColors: Record<string, StatusColor> = {
  not_reportable: "green",
  monitor: "yellow",
  potentially_significant: "yellow",
  significant_reportable: "red",
  manual_review_required: "purple",
};

const numberFacts: { key: string; label: string; sectors?: string[] }[] = [
  { key: "sector_activity_limited_hours", label: "Hur många timmar har sektorsverksamheten varit begränsad?" },
  { key: "workaround_hours", label: "Hur många timmar har alternativa arbetssätt/reservrutiner använts?" },
  { key: "sector_critical_unavailable_hours", label: "Hur många timmar har sektorskritiska system varit otillgängliga/nedsatta?" },
  { key: "external_service_unavailable_hours", label: "Hur många timmar har externa tjänster varit otillgängliga?" },
  { key: "control_monitoring_unusable_hours", label: "Hur många timmar har styrning/övervakning inte fungerat som avsett?", sectors: ["energy"] },
  { key: "affected_end_users", label: "Hur många slutanvändare är berörda?", sectors: ["energy"] },
  { key: "affected_end_users_pct", label: "Hur stor andel (%) av slutanvändarna är berörda?", sectors: ["energy"] },
  { key: "affected_users", label: "Hur många användare är berörda?", sectors: ["transport"] },
  { key: "geographic_area_km2", label: "Hur stort geografiskt område (km²) är berört?", sectors: ["transport"] },
  { key: "planned_departures_affected_pct", label: "Hur stor andel (%) av planerade avgångar påverkas per trafikdygn?", sectors: ["transport"] },
  { key: "complete_unavailability_minutes", label: "Hur många minuter har tjänsten varit helt otillgänglig?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
  { key: "limited_availability_hours", label: "Hur många timmar har tjänsten haft begränsad tillgänglighet?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
  { key: "direct_financial_loss_eur", label: "Direkt ekonomisk förlust (EUR)?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
];

const booleanFacts: { key: string; label: string; sectors?: string[] }[] = [
  { key: "sector_critical_system_affected", label: "Är ett sektorskritiskt system påverkat?" },
  { key: "protected_info_sector_critical_compromised", label: "Har skyddad information i sektorskritiskt system åtkommits av obehörig, förvanskats eller förstörts?" },
  { key: "incident_cost_exceeds_5pct_turnover", label: "Överstiger incidentens totala kostnad 5 % av föregående års omsättning/anslag?" },
  { key: "protected_info_other_party_or_500_persons", label: "Har skyddad information för annan juridisk person eller minst 500 fysiska personer komprometterats?" },
  { key: "environmental_damage", label: "Har incidenten orsakat miljöskada?" },
  { key: "other_provider_crisis_mode", label: "Har annan samhällsviktig aktör gått in i kris-/stabsläge?" },
  { key: "serious_injury_or_death", label: "Har incidenten orsakat allvarlig personskada, allvarlig sjukdom eller dödsfall?" },
  { key: "recurring_same_cause_6_months", label: "Har liknande incidenter med samma grundorsak inträffat minst två gånger på sex månader?" },
  { key: "recurring_combined_cost_meets_threshold", label: "Når incidenternas sammanlagda ekonomiska skada tröskeln?" },
  { key: "personal_data_possibly_affected", label: "Finns personuppgifter som är eller kan vara berörda?" },
  { key: "external_service_affected", label: "Är externa tjänster mot kunder/mottagare påverkade?" },
  { key: "has_cyber_insurance", label: "Har organisationen cyberförsäkring?" },
  { key: "has_contractual_reporting_obligations", label: "Finns avtalade incidentrapporteringskrav?" },
  { key: "patient_safety_reporting_triggered", label: "Har obligatorisk patientsäkerhetsrapportering utlösts?", sectors: ["healthcare"] },
  { key: "ambulance_unavailable", label: "Har ambulans/ambulanssjukvård inte kunnat tillhandahållas?", sectors: ["healthcare"] },
  { key: "trade_secrets_exfiltrated", label: "Har företagshemligheter exfiltrerats?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
  { key: "suspected_malicious_unauthorized_access_serious_disruption", label: "Misstänks antagonistisk obehörig åtkomst som kan orsaka allvarlig driftstörning?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
  { key: "malicious_cia_compromise", label: "Har riktighet/konfidentialitet/autenticitet komprometterats antagonistiskt?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
  { key: "affected_users_over_5pct_or_1m", label: "Berörs fler än 5 % av EU-användarna eller fler än 1 miljon användare?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
  { key: "service_affected", label: "Är den digitala tjänsten påverkad?", sectors: ["digital_infrastructure", "digital_providers", "ict_b2b"] },
];

export function AssessmentForm({
  tenantId,
  incidentId,
  sectors,
  latestAssessment,
}: {
  tenantId: string;
  incidentId: string;
  sectors: string[];
  latestAssessment: AssessmentRow | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<string, boolean | undefined>>({});
  const [result, setResult] = useState<AssessmentRow | null>(latestAssessment);

  const relevantNumberFacts = numberFacts.filter(
    (f) => !f.sectors || f.sectors.some((s) => sectors.includes(s)),
  );
  const relevantBooleanFacts = booleanFacts.filter(
    (f) => !f.sectors || f.sectors.some((s) => sectors.includes(s)),
  );

  async function runAssessment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const facts: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(numbers)) {
        if (value !== "") facts[key] = Number(value);
      }
      for (const [key, value] of Object.entries(bools)) {
        if (value !== undefined) facts[key] = value;
      }
      const res = await fetch(`/api/v1/incidents/${incidentId}/significance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, facts }),
      });
      if (!res.ok) {
        setError("Bedömningen kunde inte genomföras.");
        return;
      }
      const body = await res.json();
      setResult(body.data.assessment as AssessmentRow);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approve(decision: "approved" | "rejected") {
    if (!result) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/incidents/${incidentId}/significance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, assessmentId: result.id, decision }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={runAssessment} className="space-y-6 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Uppgifter om påverkan</h2>
        <p className="text-sm text-muted-foreground">
          Fyll i det ni vet. Lämna fält tomma om uppgiften är okänd — systemet
          gissar aldrig och visar vilka uppgifter som saknas.
        </p>

        <div className="space-y-4">
          {relevantNumberFacts.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`nf-${f.key}`}>{f.label}</Label>
              <Input
                id={`nf-${f.key}`}
                type="number"
                min={0}
                step="0.1"
                value={numbers[f.key] ?? ""}
                onChange={(e) =>
                  setNumbers((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Ja/nej-frågor</legend>
          {relevantBooleanFacts.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-3 text-sm">
              <span id={`bf-label-${f.key}`}>{f.label}</span>
              <span
                role="group"
                aria-labelledby={`bf-label-${f.key}`}
                className="flex shrink-0 gap-1"
              >
                <Button
                  type="button"
                  size="xs"
                  variant={bools[f.key] === true ? "default" : "outline"}
                  onClick={() => setBools((prev) => ({ ...prev, [f.key]: true }))}
                >
                  Ja
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={bools[f.key] === false ? "default" : "outline"}
                  onClick={() => setBools((prev) => ({ ...prev, [f.key]: false }))}
                >
                  Nej
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={bools[f.key] === undefined ? "secondary" : "ghost"}
                  onClick={() => setBools((prev) => ({ ...prev, [f.key]: undefined }))}
                >
                  Vet ej
                </Button>
              </span>
            </div>
          ))}
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Bedömer…" : "Kör bedömning"}
        </Button>
      </form>

      <div className="space-y-4">
        {result ? (
          <section className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge color={recommendationColors[result.recommendation] ?? "gray"}>
                {recommendationLabels[result.recommendation] ?? result.recommendation}
              </StatusBadge>
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
              {result.rule_coverage_partial ? (
                <StatusBadge color="purple">Delvis regeltäckning</StatusBadge>
              ) : null}
              <StatusBadge color={result.approval_status === "approved" ? "green" : "blue"}>
                {result.approval_status === "approved"
                  ? "Godkänd"
                  : result.approval_status === "rejected"
                    ? "Avvisad"
                    : "Väntar på godkännande"}
              </StatusBadge>
            </div>

            {result.reasons.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold">Varför:</h3>
                <ul className="mt-1 mb-4 list-disc space-y-1 pl-5 text-sm">
                  {result.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {result.missing_facts.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold">Uppgifter som saknas:</h3>
                <ul className="mt-1 mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.missing_facts.map((f) => (
                    <li key={f} className="font-mono text-xs">
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <h3 className="text-sm font-semibold">Nästa steg:</h3>
            <ol className="mt-1 mb-4 list-decimal space-y-1 pl-5 text-sm">
              {result.next_steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>

            {result.deadline_definitions.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold">Tidsfrister som aktiveras:</h3>
                <ul className="mt-1 mb-4 list-disc space-y-1 pl-5 text-sm">
                  {result.deadline_definitions.map((d) => (
                    <li key={d.deadlineType}>
                      {d.titleSv}
                      {d.hoursFromSignificant
                        ? ` (${d.hoursFromSignificant} h från identifiering som betydande)`
                        : d.daysFromNotification
                          ? ` (${d.daysFromNotification} dagar efter incidentanmälan)`
                          : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="mb-4 flex flex-wrap gap-1.5">
              {result.also_assess_gdpr ? <StatusBadge color="blue">GDPR/IMY-spår</StatusBadge> : null}
              {result.also_assess_state_agency ? <StatusBadge color="blue">Statligt spår</StatusBadge> : null}
              {result.also_assess_eidas ? <StatusBadge color="blue">eIDAS-spår</StatusBadge> : null}
              {result.also_assess_pts ? <StatusBadge color="purple">PTS-spår (manuell)</StatusBadge> : null}
              {result.also_assess_contracts ? <StatusBadge color="blue">Avtalsspår</StatusBadge> : null}
              {result.also_assess_insurance ? <StatusBadge color="blue">Försäkringsspår</StatusBadge> : null}
            </div>

            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Visa regelkälla
              </summary>
              <ul className="mt-2 space-y-2 text-sm">
                {result.matched_rules.map((r) => (
                  <li key={`${r.ruleSetCode}-${r.ruleCode}`} className="rounded-lg border p-3">
                    <p className="font-medium">{r.titleSv}</p>
                    <p className="text-muted-foreground">{r.reasonSv}</p>
                    {r.legalReference ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {r.legalReference}
                      </p>
                    ) : null}
                  </li>
                ))}
                {result.matched_rules.length === 0 ? (
                  <li className="text-muted-foreground">Inga regler matchade.</li>
                ) : null}
              </ul>
            </details>

            {result.approval_status === "pending" ? (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => approve("approved")} disabled={busy} size="sm">
                  Godkänn bedömningen
                </Button>
                <Button
                  onClick={() => approve("rejected")}
                  disabled={busy}
                  size="sm"
                  variant="destructive"
                >
                  Avvisa
                </Button>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Ingen bedömning ännu. Fyll i uppgifterna och kör bedömningen.
          </section>
        )}

        <p className="text-sm">
          <Link href={`/app/incidents/${incidentId}`} className="text-primary hover:underline">
            ← Tillbaka till incidenten
          </Link>
        </p>
      </div>
    </div>
  );
}
