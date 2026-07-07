"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type StatusColor } from "@/components/app/status-badge";

interface GdprAssessment {
  id: string;
  status: string;
  personal_data_involved: boolean | null;
  data_categories: string[] | null;
  data_subjects_count: number | null;
  disclosed: boolean | null;
  destroyed: boolean | null;
  altered: boolean | null;
  lost: boolean | null;
  unavailable: boolean | null;
  risk_to_rights: boolean | null;
  high_risk: boolean | null;
  imy_notification_required: boolean | null;
  data_subject_notification_required: boolean | null;
  awareness_at: string | null;
  imy_deadline_at: string | null;
  not_reporting_reason: string | null;
  dpo_approved_at: string | null;
}

const statusLabels: Record<string, { label: string; color: StatusColor }> = {
  not_assessed: { label: "Ej bedömd", color: "gray" },
  assessment_in_progress: { label: "Bedömning pågår", color: "blue" },
  report_required: { label: "Anmälan till IMY krävs", color: "red" },
  not_report_required: { label: "Anmälan krävs inte", color: "green" },
  submitted_to_imy: { label: "Anmäld till IMY", color: "green" },
  late: { label: "Försenad", color: "red" },
  data_subject_notification_required: { label: "Registrerade ska informeras", color: "yellow" },
  data_subjects_notified: { label: "Registrerade informerade", color: "green" },
};

function TriState({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex shrink-0 gap-1">
        <Button type="button" size="xs" variant={value === true ? "default" : "outline"} onClick={() => onChange(true)}>
          Ja
        </Button>
        <Button type="button" size="xs" variant={value === false ? "default" : "outline"} onClick={() => onChange(false)}>
          Nej
        </Button>
        <Button type="button" size="xs" variant={value === undefined ? "secondary" : "ghost"} onClick={() => onChange(undefined)}>
          Vet ej
        </Button>
      </span>
    </div>
  );
}

export function GdprForm({
  tenantId,
  incidentId,
  assessment,
}: {
  tenantId: string;
  incidentId: string;
  assessment: GdprAssessment | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const b = (v: boolean | null | undefined) => (v === null ? undefined : v);

  const [personalData, setPersonalData] = useState<boolean | undefined>(b(assessment?.personal_data_involved));
  const [categories, setCategories] = useState((assessment?.data_categories ?? []).join(", "));
  const [subjects, setSubjects] = useState(assessment?.data_subjects_count?.toString() ?? "");
  const [disclosed, setDisclosed] = useState<boolean | undefined>(b(assessment?.disclosed));
  const [destroyed, setDestroyed] = useState<boolean | undefined>(b(assessment?.destroyed));
  const [altered, setAltered] = useState<boolean | undefined>(b(assessment?.altered));
  const [lost, setLost] = useState<boolean | undefined>(b(assessment?.lost));
  const [unavailable, setUnavailable] = useState<boolean | undefined>(b(assessment?.unavailable));
  const [riskToRights, setRiskToRights] = useState<boolean | undefined>(b(assessment?.risk_to_rights));
  const [highRisk, setHighRisk] = useState<boolean | undefined>(b(assessment?.high_risk));
  const [imyRequired, setImyRequired] = useState<boolean | undefined>(b(assessment?.imy_notification_required));
  const [subjectNotify, setSubjectNotify] = useState<boolean | undefined>(b(assessment?.data_subject_notification_required));
  const [awarenessAt, setAwarenessAt] = useState(
    assessment?.awareness_at ? assessment.awareness_at.slice(0, 16) : "",
  );
  const [notReportingReason, setNotReportingReason] = useState(assessment?.not_reporting_reason ?? "");
  const [imyReference, setImyReference] = useState("");

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/gdpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          incidentId,
          personalDataInvolved: personalData,
          dataCategories: categories
            ? categories.split(",").map((c) => c.trim()).filter(Boolean)
            : undefined,
          dataSubjectsCount: subjects ? Number(subjects) : undefined,
          disclosed,
          destroyed,
          altered,
          lost,
          unavailable,
          riskToRights,
          highRisk,
          imyNotificationRequired: imyRequired,
          dataSubjectNotificationRequired: subjectNotify,
          awarenessAt: awarenessAt ? new Date(awarenessAt).toISOString() : undefined,
          notReportingReason: notReportingReason || undefined,
          ...extra,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Kunde inte spara bedömningen.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const status = assessment?.status ?? "not_assessed";
  const statusInfo = statusLabels[status] ?? { label: status, color: "gray" as StatusColor };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Finns personuppgifter?</h2>

        <TriState label="Är personuppgifter berörda av incidenten?" value={personalData} onChange={setPersonalData} />

        {personalData !== false ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="g-cat">Vilka kategorier av personuppgifter?</Label>
              <Input
                id="g-cat"
                placeholder="ex. namn, personnummer, hälsouppgifter"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-subj">Hur många registrerade berörs (uppskattning)?</Label>
              <Input
                id="g-subj"
                type="number"
                min={0}
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
              />
            </div>

            <TriState label="Har uppgifter röjts (obehörig åtkomst)?" value={disclosed} onChange={setDisclosed} />
            <TriState label="Har uppgifter förstörts?" value={destroyed} onChange={setDestroyed} />
            <TriState label="Har uppgifter ändrats?" value={altered} onChange={setAltered} />
            <TriState label="Har uppgifter gått förlorade?" value={lost} onChange={setLost} />
            <TriState label="Är uppgifter otillgängliga?" value={unavailable} onChange={setUnavailable} />
            <TriState label="Finns risk för de registrerades fri- och rättigheter?" value={riskToRights} onChange={setRiskToRights} />
            <TriState label="Är risken hög?" value={highRisk} onChange={setHighRisk} />

            <div className="space-y-1.5">
              <Label htmlFor="g-aware">När fick ni kännedom om incidenten?</Label>
              <Input
                id="g-aware"
                type="datetime-local"
                value={awarenessAt}
                onChange={(e) => setAwarenessAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                72-timmarsfristen till IMY räknas normalt från denna tidpunkt.
              </p>
            </div>

            <TriState label="Ska IMY anmälas?" value={imyRequired} onChange={setImyRequired} />
            {imyRequired === false ? (
              <div className="space-y-1.5">
                <Label htmlFor="g-noreport">Motivering till att inte anmäla (krävs)</Label>
                <Textarea
                  id="g-noreport"
                  rows={2}
                  value={notReportingReason}
                  onChange={(e) => setNotReportingReason(e.target.value)}
                />
              </div>
            ) : null}
            <TriState label="Ska de registrerade informeras?" value={subjectNotify} onChange={setSubjectNotify} />
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={busy}>
            {busy ? "Sparar…" : "Spara bedömning"}
          </Button>
          <Button variant="outline" onClick={() => save({ dpoApprove: true })} disabled={busy}>
            DPO godkänner bedömningen
          </Button>
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Status</h2>
          <div className="flex flex-wrap gap-2">
            <StatusBadge color={statusInfo.color}>{statusInfo.label}</StatusBadge>
            {assessment?.imy_deadline_at ? (
              <StatusBadge color="yellow">
                IMY-frist: {new Date(assessment.imy_deadline_at).toLocaleString("sv-SE")}
              </StatusBadge>
            ) : null}
            {assessment?.dpo_approved_at ? (
              <StatusBadge color="green">DPO godkänd</StatusBadge>
            ) : (
              <StatusBadge color="yellow">DPO-godkännande saknas</StatusBadge>
            )}
          </div>
        </section>

        {status === "report_required" || status === "submitted_to_imy" ? (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Anmälan till IMY</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Skapa IMY-rapportutkastet under incidentens rapporter (steget
              &quot;Anmälan till IMY&quot;). Markera sedan anmälan som inskickad här
              och spara IMY:s referens.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-imyref">IMY-referens</Label>
                <Input
                  id="g-imyref"
                  value={imyReference}
                  onChange={(e) => setImyReference(e.target.value)}
                />
              </div>
              <Button
                disabled={busy || status === "submitted_to_imy"}
                onClick={() => save({ markSubmittedToImy: true, imyReference })}
              >
                Markera anmäld till IMY
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
