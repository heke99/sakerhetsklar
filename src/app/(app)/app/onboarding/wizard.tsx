"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

interface StepDef {
  key: string;
  title: string;
  description: string | null;
}

interface SectorRow {
  code: string;
  name_sv: string;
  annex: string | null;
}

interface SubsectorRow {
  code: string;
  sector_code: string;
  name_sv: string;
}

interface ScopeResultView {
  likely_covered: string;
  classification: string | null;
  supervisory_authorities: string[];
  active_rule_packages: string[];
  pending_rule_packages: string[];
  manual_review_reasons: string[];
  next_steps: string[];
  confidence: string;
}

export function OnboardingWizard({
  tenantId,
  tenantName,
  organizationNumber,
  steps,
  progress,
  sectors,
  subsectors,
  latestSizeClass,
}: {
  tenantId: string;
  tenantName: string;
  organizationNumber: string | null;
  steps: StepDef[];
  progress: Record<string, string>;
  sectors: SectorRow[];
  subsectors: SubsectorRow[];
  latestSizeClass: string | null;
}) {
  const router = useRouter();
  const firstIncomplete = useMemo(() => {
    const idx = steps.findIndex((s) => progress[s.key] !== "completed");
    return idx === -1 ? steps.length - 1 : idx;
  }, [steps, progress]);

  const [stepIndex, setStepIndex] = useState(firstIncomplete);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step state
  const [entityType, setEntityType] = useState("private_company");
  const [employees, setEmployees] = useState("");
  const [turnover, setTurnover] = useState("");
  const [balance, setBalance] = useState("");
  const [includeGroup, setIncludeGroup] = useState(false);
  const [groupEmployees, setGroupEmployees] = useState("");
  const [groupTurnover, setGroupTurnover] = useState("");
  const [groupBalance, setGroupBalance] = useState("");
  const [sizeClass, setSizeClass] = useState<string | null>(latestSizeClass);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedSubsectors, setSelectedSubsectors] = useState<string[]>([]);
  const [digitalFlags, setDigitalFlags] = useState({
    isDnsProvider: false,
    isTldRegistry: false,
    isTelecomProvider: false,
    isTrustServiceProvider: false,
    isCerEntity: false,
    suppliesCriticalEntities: false,
    handlesSecurityClassifiedInfo: false,
    providesCriticalPublicServices: false,
  });
  const [scopeResult, setScopeResult] = useState<ScopeResultView | null>(null);

  const step = steps[stepIndex];

  async function markStep(stepKey: string, status: string) {
    await fetch("/api/v1/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, stepKey, status }),
    });
  }

  async function completeAndNext(stepKey: string) {
    setBusy(true);
    setError(null);
    try {
      await markStep(stepKey, "completed");
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitSize() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/scope/size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          employees: Number(employees || 0),
          annualTurnoverEur: turnover ? Number(turnover) * 1_000_000 : null,
          balanceSheetTotalEur: balance ? Number(balance) * 1_000_000 : null,
          includeGroup,
          groupEmployees: groupEmployees ? Number(groupEmployees) : null,
          groupTurnoverEur: groupTurnover ? Number(groupTurnover) * 1_000_000 : null,
          groupBalanceSheetTotalEur: groupBalance ? Number(groupBalance) * 1_000_000 : null,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte spara storleksbedömningen.");
        return;
      }
      const body = await res.json();
      setSizeClass(body.data.result.sizeClass);
      await markStep("size_assessment", "completed");
      setStepIndex((i) => i + 1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitScope() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          entityType,
          sectors: selectedSectors,
          subsectors: selectedSubsectors,
          ...digitalFlags,
        }),
      });
      if (!res.ok) {
        setError("Kunde inte genomföra bedömningen.");
        return;
      }
      const body = await res.json();
      setScopeResult(body.data.result as ScopeResultView);
      setStepIndex((i) => i + 1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  const sizeLabels: Record<string, string> = {
    micro: "Mikroföretag",
    small: "Litet företag",
    medium: "Medelstort företag",
    large: "Stort företag",
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <ol aria-label="Steg" className="space-y-1">
        {steps.map((s, i) => {
          const status = progress[s.key];
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setStepIndex(i)}
                aria-current={i === stepIndex ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  i === stepIndex
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs",
                    status === "completed"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border",
                  )}
                >
                  {status === "completed" ? "✓" : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          );
        })}
      </ol>

      <section
        aria-live="polite"
        className="rounded-xl border bg-card p-6"
      >
        <h2 className="text-xl font-semibold">{step.title}</h2>
        {step.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        ) : null}

        <div className="mt-6">
          {step.key === "organization" ? (
            <div className="space-y-4">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Organisation</dt>
                  <dd className="font-medium">{tenantName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Organisationsnummer</dt>
                  <dd className="font-medium">{organizationNumber ?? "Saknas"}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                Kontrollera uppgifterna under{" "}
                <Link href="/app/settings" className="text-primary hover:underline">
                  Inställningar
                </Link>{" "}
                och gå sedan vidare.
              </p>
              <Button onClick={() => completeAndNext("organization")} disabled={busy}>
                Uppgifterna stämmer — nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "legal_entities" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Lägg till juridiska enheter, koncernstruktur och ägarförhållanden under{" "}
                <Link href="/app/settings" className="text-primary hover:underline">
                  Inställningar
                </Link>
                . Om organisationen är en enda juridisk enhet kan du gå vidare direkt.
              </p>
              <Button onClick={() => completeAndNext("legal_entities")} disabled={busy}>
                Klart — nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "size_assessment" ? (
            <form
              className="max-w-xl space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitSize();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="employees">Antal anställda</Label>
                  <Input
                    id="employees"
                    type="number"
                    min={0}
                    required
                    value={employees}
                    onChange={(e) => setEmployees(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="turnover">Omsättning (MEUR)</Label>
                  <Input
                    id="turnover"
                    type="number"
                    min={0}
                    step="0.1"
                    value={turnover}
                    onChange={(e) => setTurnover(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="balance">Balansomslutning (MEUR)</Label>
                  <Input
                    id="balance"
                    type="number"
                    min={0}
                    step="0.1"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeGroup}
                  onChange={(e) => setIncludeGroup(e.target.checked)}
                />
                Koncernens siffror ska påverka storleksbedömningen
              </label>

              {includeGroup ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="g-emp">Anställda (koncern)</Label>
                    <Input
                      id="g-emp"
                      type="number"
                      min={0}
                      value={groupEmployees}
                      onChange={(e) => setGroupEmployees(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="g-turn">Omsättning koncern (MEUR)</Label>
                    <Input
                      id="g-turn"
                      type="number"
                      min={0}
                      step="0.1"
                      value={groupTurnover}
                      onChange={(e) => setGroupTurnover(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="g-bal">Balansomslutning koncern (MEUR)</Label>
                    <Input
                      id="g-bal"
                      type="number"
                      min={0}
                      step="0.1"
                      value={groupBalance}
                      onChange={(e) => setGroupBalance(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {sizeClass ? (
                <p className="text-sm">
                  Senaste bedömning:{" "}
                  <StatusBadge color="blue">{sizeLabels[sizeClass] ?? sizeClass}</StatusBadge>
                </p>
              ) : null}

              <Button type="submit" disabled={busy}>
                Beräkna storlek och gå vidare
              </Button>
            </form>
          ) : null}

          {step.key === "sector_assessment" ? (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                void submitScope();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="entity-type">Organisationstyp</Label>
                <select
                  id="entity-type"
                  className="h-9 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                >
                  <option value="private_company">Privat företag</option>
                  <option value="municipality">Kommun</option>
                  <option value="region">Region</option>
                  <option value="municipal_company">Kommunalt bolag</option>
                  <option value="state_agency">Statlig myndighet</option>
                  <option value="other_public_body">Annat offentligt organ</option>
                  <option value="non_profit">Ideell organisation</option>
                  <option value="other">Övrigt</option>
                </select>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Vilka sektorer gäller för verksamheten?
                </legend>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {sectors.map((s) => (
                    <label key={s.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSectors.includes(s.code)}
                        onChange={() =>
                          setSelectedSectors((prev) => toggle(prev, s.code))
                        }
                      />
                      {s.name_sv}
                      <span className="text-xs text-muted-foreground">
                        {s.annex === "annex_1" ? "Bilaga 1" : s.annex === "annex_2" ? "Bilaga 2" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {selectedSectors.length > 0 ? (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Undersektorer</legend>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {subsectors
                      .filter((ss) => selectedSectors.includes(ss.sector_code))
                      .map((ss) => (
                        <label key={ss.code} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedSubsectors.includes(ss.code)}
                            onChange={() =>
                              setSelectedSubsectors((prev) => toggle(prev, ss.code))
                            }
                          />
                          {ss.name_sv}
                        </label>
                      ))}
                  </div>
                </fieldset>
              ) : null}

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Särskilda kategorier</legend>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(
                    [
                      ["isDnsProvider", "DNS-tjänsteleverantör"],
                      ["isTldRegistry", "Toppdomänsregister (TLD)"],
                      ["isTelecomProvider", "Telekom / allmänna elektroniska kommunikationsnät"],
                      ["isTrustServiceProvider", "Betrodda tjänster (eIDAS)"],
                      ["isCerEntity", "CER-entitet (kritisk entitet)"],
                      ["suppliesCriticalEntities", "Leverantör till kritiska/offentliga verksamheter"],
                      ["handlesSecurityClassifiedInfo", "Hanterar säkerhetsskyddsklassificerade uppgifter"],
                      ["providesCriticalPublicServices", "Tillhandahåller kritiska samhällstjänster"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={digitalFlags[key]}
                        onChange={(e) =>
                          setDigitalFlags((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Button type="submit" disabled={busy || selectedSectors.length === 0}>
                Skapa regelprofil
              </Button>
            </form>
          ) : null}

          {step.key === "rule_profile" ? (
            <div className="space-y-4">
              {scopeResult ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      color={
                        scopeResult.likely_covered === "yes"
                          ? "green"
                          : scopeResult.likely_covered === "manual_review"
                            ? "purple"
                            : "gray"
                      }
                    >
                      {scopeResult.likely_covered === "yes"
                        ? "Omfattas sannolikt"
                        : scopeResult.likely_covered === "manual_review"
                          ? "Manuell bedömning krävs"
                          : "Omfattas sannolikt inte"}
                    </StatusBadge>
                    {scopeResult.classification ? (
                      <StatusBadge color="blue">
                        {scopeResult.classification === "essential"
                          ? "Väsentlig"
                          : scopeResult.classification === "important"
                            ? "Viktig"
                            : scopeResult.classification === "public"
                              ? "Offentlig förvaltning"
                              : "Manuell bedömning"}
                      </StatusBadge>
                    ) : null}
                  </div>
                  {scopeResult.manual_review_reasons.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {scopeResult.manual_review_reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-sm">
                    Se hela regelprofilen under{" "}
                    <Link href="/app/scope" className="text-primary hover:underline">
                      Omfattas vi?
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <p className="text-sm">
                  Regelprofilen skapas i steget Sektor- och verksamhetsbedömning. Se
                  resultatet under{" "}
                  <Link href="/app/scope" className="text-primary hover:underline">
                    Omfattas vi?
                  </Link>
                  .
                </p>
              )}
              <Button onClick={() => completeAndNext("rule_profile")} disabled={busy}>
                Nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "registration" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Registrering enligt MCFFS 2026:1 är aktiv från 2 februari 2026.
                Checklista och registreringsstöd finns under{" "}
                <Link href="/app/scope" className="text-primary hover:underline">
                  Omfattas vi?
                </Link>
                . Ändringar ska anmälas inom 14 dagar där det är relevant.
              </p>
              <Button onClick={() => completeAndNext("registration")} disabled={busy}>
                Klart — nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "systems" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Lägg till kritiska system och tjänster under{" "}
                <Link href="/app/systems" className="text-primary hover:underline">
                  System
                </Link>{" "}
                och{" "}
                <Link href="/app/critical-services" className="text-primary hover:underline">
                  Kritiska tjänster
                </Link>
                . Du kan importera från Excel eller skapa manuellt.
              </p>
              <Button onClick={() => completeAndNext("systems")} disabled={busy}>
                Klart — nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "vendors" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Registrera leverantörer, incidentkontakter och avtal under{" "}
                <Link href="/app/vendors" className="text-primary hover:underline">
                  Leverantörer
                </Link>
                .
              </p>
              <Button onClick={() => completeAndNext("vendors")} disabled={busy}>
                Klart — nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "incident_roles" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Utse incidentroller (incidentansvarig, CISO, juridik, DPO,
                kommunikation, ledningsgodkännare) under{" "}
                <Link href="/app/settings" className="text-primary hover:underline">
                  Inställningar
                </Link>
                .
              </p>
              <Button onClick={() => completeAndNext("incident_roles")} disabled={busy}>
                Klart — nästa steg
              </Button>
            </div>
          ) : null}

          {step.key === "complete" ? (
            <div className="space-y-4">
              <p className="text-sm">
                Onboarding klar. Fortsätt till{" "}
                <Link href="/app/overview" className="text-primary hover:underline">
                  Översikt
                </Link>{" "}
                för readiness, saknade uppgifter och nästa steg.
              </p>
              <Button onClick={() => completeAndNext("complete")} disabled={busy}>
                Slutför onboarding
              </Button>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
