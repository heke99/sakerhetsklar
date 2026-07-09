"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { REPORT_STATUS_SV, svLabel } from "@/lib/labels/sv";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/app/status-badge";

interface FieldDef {
  key: string;
  label: string;
  copyLabel: string;
  type: string;
  required: boolean;
  helpText: string | null;
  legalReference: string | null;
}

export function ReportEditor({
  tenantId,
  reportId,
  incidentId,
  status,
  dueAt,
  cyberportalId,
  receipts,
  definitions,
  initialValues,
}: {
  tenantId: string;
  reportId: string;
  incidentId: string;
  status: string;
  dueAt: string | null;
  cyberportalId: string | null;
  receipts: { id: string; file_name: string }[];
  definitions: FieldDef[];
  initialValues: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [copyMode, setCopyMode] = useState(false);
  const [cpId, setCpId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, fields: values }),
      });
      setMessage(res.ok ? "Sparat." : "Kunde inte spara.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(newStatus: string, extra?: Record<string, string>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, status: newStatus, ...extra }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage(body?.error?.message ?? "Statusändringen misslyckades.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyField(def: FieldDef) {
    await navigator.clipboard.writeText(values[def.key] ?? "");
    setCopiedField(def.key);
    setTimeout(() => setCopiedField(null), 1500);
  }

  async function copyAll() {
    const text = definitions
      .map((d) => `${d.copyLabel}:\n${values[d.key] ?? ""}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setMessage("Alla fält kopierade till urklipp.");
  }

  const missingRequired = definitions.filter((d) => d.required && !values[d.key]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          color={
            status === "draft"
              ? "gray"
              : status === "ready_for_review"
                ? "blue"
                : status === "late"
                  ? "red"
                  : "green"
          }
        >
          {svLabel(REPORT_STATUS_SV, status)}
        </StatusBadge>
        {dueAt ? (
          <StatusBadge color="yellow">
            Deadline: {new Date(dueAt).toLocaleString("sv-SE")}
          </StatusBadge>
        ) : null}
        {cyberportalId ? (
          <StatusBadge color="green">Cyberportalen-ID: {cyberportalId}</StatusBadge>
        ) : (
          <StatusBadge color="yellow">Cyberportalen-ID saknas</StatusBadge>
        )}
        {missingRequired.length > 0 ? (
          <StatusBadge color="yellow">
            {missingRequired.length} obligatoriska fält saknas
          </StatusBadge>
        ) : (
          <StatusBadge color="green">Alla obligatoriska fält ifyllda</StatusBadge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={copyMode ? "secondary" : "default"} onClick={() => setCopyMode((m) => !m)}>
          {copyMode ? "Stäng kopieringsläge" : "Öppna kopiera-till-Cyberportalen"}
        </Button>
        <Button variant="outline" onClick={save} disabled={busy}>
          Spara fält
        </Button>
        <a
          href={`/api/v1/reports/${reportId}/export?format=pdf`}
          className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
        >
          Exportera PDF
        </a>
        <a
          href={`/api/v1/reports/${reportId}/export?format=docx`}
          className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
        >
          Exportera Word
        </a>
      </div>

      {message ? <p className="text-sm">{message}</p> : null}

      {copyMode ? (
        <section className="rounded-xl border-2 border-primary/40 bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Kopiera till Cyberportalen</h2>
              <p className="text-sm text-muted-foreground">
                Fälten visas i samma ordning som i Cyberportalen. Kopiera fält för
                fält eller allt på en gång.
              </p>
            </div>
            <Button onClick={copyAll} variant="outline">
              Kopiera allt
            </Button>
          </div>
          <ol className="space-y-3">
            {definitions.map((d, i) => (
              <li key={d.key} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {i + 1}. {d.copyLabel}
                      {d.required ? " *" : ""}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                      {values[d.key] || "—"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyField(d)}>
                    {copiedField === d.key ? "Kopierat!" : "Kopiera"}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Rapportfält</h2>
          <div className="space-y-4">
            {definitions.map((d) => (
              <div key={d.key} className="space-y-1.5">
                <Label htmlFor={`f-${d.key}`}>
                  {d.label}
                  {d.required ? " *" : ""}
                </Label>
                {d.helpText ? (
                  <p className="text-xs text-muted-foreground">{d.helpText}</p>
                ) : null}
                {d.type === "textarea" ? (
                  <Textarea
                    id={`f-${d.key}`}
                    rows={3}
                    value={values[d.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [d.key]: e.target.value }))
                    }
                  />
                ) : (
                  <Input
                    id={`f-${d.key}`}
                    type={d.type === "datetime" ? "datetime-local" : d.type === "number" ? "number" : "text"}
                    value={values[d.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [d.key]: e.target.value }))
                    }
                  />
                )}
                {d.legalReference ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    {d.legalReference}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={save} disabled={busy}>
              {busy ? "Sparar…" : "Spara fält"}
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Statusflöde</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || status !== "draft"}
            onClick={() => setStatus("ready_for_review")}
          >
            1. Klar för granskning
          </Button>
          <Button
            variant="outline"
            disabled={busy || status !== "ready_for_review"}
            onClick={() => setStatus("approved")}
          >
            2. Godkänn (juridik/ledning)
          </Button>
        </div>

        {status === "approved" ? (
          <div className="mt-4 space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">3. Markera som inskickad i Cyberportalen</h3>
            <p className="text-sm text-muted-foreground">
              Inskickning kräver inlämningsreferens (Cyberportalen-ID) eller en
              dokumenterad motivering för undantag (ex. reservförfarande).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="submit-cp-id">Cyberportalen-ID</Label>
                <Input
                  id="submit-cp-id"
                  value={cpId}
                  onChange={(e) => setCpId(e.target.value)}
                  placeholder="ex. CP-2026-12345"
                />
              </div>
              <Button
                disabled={busy || !cpId}
                onClick={() =>
                  setStatus("submitted_in_cyberportalen", { cyberportalId: cpId })
                }
              >
                Markera som inskickad
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 space-y-1.5">
                <Label htmlFor="submit-override">
                  Eller markera utan referens (motivering krävs)
                </Label>
                <Input
                  id="submit-override"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Motivering, ex. reservförfarande via rekommenderat brev"
                />
              </div>
              <Button
                variant="destructive"
                disabled={busy || overrideReason.length < 10}
                onClick={() =>
                  setStatus("submitted_in_cyberportalen", { overrideReason })
                }
              >
                Markera utan referens
              </Button>
            </div>
          </div>
        ) : null}

        {status === "submitted_in_cyberportalen" || status === "cyberportal_incident_id_saved" ? (
          <div className="mt-4 space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">4. Spara Cyberportalens ärende-ID</h3>
            <p className="text-sm text-muted-foreground">
              Varje rapportsteg kan få ett eget ID. Steget kan inte stängas utan ID
              eller en uttrycklig motivering.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-id">Cyberportalen-ID</Label>
                <Input
                  id="cp-id"
                  value={cpId}
                  onChange={(e) => setCpId(e.target.value)}
                  placeholder="ex. CP-2026-12345"
                />
              </div>
              <Button
                disabled={busy || !cpId}
                onClick={() =>
                  setStatus("cyberportal_incident_id_saved", { cyberportalId: cpId })
                }
              >
                Spara ID
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 space-y-1.5">
                <Label htmlFor="cp-override">Eller stäng utan ID (motivering krävs)</Label>
                <Input
                  id="cp-override"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Motivering, ex. reservförfarande via rekommenderat brev"
                />
              </div>
              <Button
                variant="destructive"
                disabled={busy || overrideReason.length < 10}
                onClick={() =>
                  setStatus("cyberportal_incident_id_saved", { overrideReason })
                }
              >
                Stäng utan ID
              </Button>
            </div>
          </div>
        ) : null}

        {receipts.length > 0 ? (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Kvitton</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {receipts.map((r) => (
                <li key={r.id}>{r.file_name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <p className="text-sm">
        <Link href={`/app/incidents/${incidentId}/reports`} className="text-primary hover:underline">
          ← Tillbaka till rapportöversikten
        </Link>
      </p>
    </div>
  );
}
