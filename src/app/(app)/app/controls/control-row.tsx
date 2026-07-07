"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge, type StatusColor } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ControlDto {
  id: string;
  code: string;
  area: string | null;
  title_sv: string;
  description_sv: string | null;
  legal_reference: string | null;
  owner_role: string | null;
  assigned_user_name: string | null;
  status: string;
  evidence_required: boolean;
  evidence_uploaded: boolean;
  deadline: string | null;
  comments: string | null;
}

const statusColors: Record<string, StatusColor> = {
  not_started: "gray",
  in_progress: "blue",
  evidence_required: "yellow",
  ready_for_review: "blue",
  approved: "green",
  overdue: "red",
  risk_accepted: "purple",
  not_applicable: "gray",
};

const statusLabels: Record<string, string> = {
  not_started: "Ej påbörjad",
  in_progress: "Pågår",
  evidence_required: "Bevis krävs",
  ready_for_review: "Klar för granskning",
  approved: "Godkänd",
  overdue: "Försenad",
  risk_accepted: "Risk accepterad",
  not_applicable: "Ej tillämplig",
};

export function ControlRow({
  tenantId,
  control,
}: {
  tenantId: string;
  control: ControlDto;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(control.status);
  const [assignee, setAssignee] = useState(control.assigned_user_name ?? "");
  const [deadline, setDeadline] = useState(control.deadline ?? "");

  async function save() {
    setBusy(true);
    try {
      await fetch("/api/v1/controls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          controlId: control.id,
          status,
          assignedUserName: assignee || undefined,
          deadline: deadline || null,
        }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium">
            <span className="font-mono text-xs text-muted-foreground">{control.code}</span>{" "}
            {control.title_sv}
          </p>
          <p className="text-xs text-muted-foreground">
            Ägarroll: {control.owner_role ?? "–"}
            {control.assigned_user_name ? ` · Tilldelad: ${control.assigned_user_name}` : " · Ej tilldelad"}
            {control.deadline ? ` · Deadline: ${control.deadline}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {control.evidence_required && !control.evidence_uploaded && control.status === "approved" ? (
            <StatusBadge color="yellow">Bevis saknas</StatusBadge>
          ) : null}
          <StatusBadge color={statusColors[control.status] ?? "gray"}>
            {statusLabels[control.status] ?? control.status}
          </StatusBadge>
        </div>
      </button>

      {open ? (
        <div className="border-t px-4 py-4">
          {control.description_sv ? (
            <p className="mb-3 text-sm">{control.description_sv}</p>
          ) : null}
          {control.legal_reference ? (
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Visa regelkälla
              </summary>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {control.legal_reference}
              </p>
            </details>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`status-${control.id}`}>Status</Label>
              <select
                id={`status-${control.id}`}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`assignee-${control.id}`}>Tilldelad</Label>
              <Input
                id={`assignee-${control.id}`}
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Namn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`deadline-${control.id}`}>Deadline</Label>
              <Input
                id={`deadline-${control.id}`}
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={save} disabled={busy} size="sm">
              {busy ? "Sparar…" : "Spara"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
