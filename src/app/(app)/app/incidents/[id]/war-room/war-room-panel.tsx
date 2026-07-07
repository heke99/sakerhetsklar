"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/app/status-badge";

interface WarRoomData {
  id: string;
  status: string;
  activated_at: string;
  war_room_members: { id: string; member_name: string; role: string | null; is_external: boolean }[];
  war_room_decisions: {
    id: string;
    decision: string;
    reason: string;
    approver_name: string;
    selected_option: string | null;
    options_considered: string | null;
    decided_at: string;
  }[];
  war_room_tasks: { id: string; title: string; assigned_to_name: string | null; status: string }[];
  war_room_messages: { id: string; body: string; created_by_name: string | null; created_at: string }[];
}

export function WarRoomPanel({
  tenantId,
  incidentId,
  warRoom,
  deadlines,
  reports,
  evidence,
}: {
  tenantId: string;
  incidentId: string;
  warRoom: WarRoomData | null;
  deadlines: { deadline_type: string; due_at: string; status: string }[];
  reports: { id: string; report_stage: string; status: string }[];
  evidence: { id: string; file_name: string; classification: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [decision, setDecision] = useState("");
  const [options, setOptions] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [reason, setReason] = useState("");
  const [approver, setApprover] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [message, setMessage] = useState("");

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await fetch(`/api/v1/incidents/${incidentId}/war-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, action, ...payload }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!warRoom) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          War room är inte aktiverat för denna incident. Aktivera vid allvarliga
          eller betydande incidenter för samlad beslutslogg, uppgifter och
          kommunikation.
        </p>
        <Button onClick={() => act("activate")} disabled={busy}>
          Aktivera war room
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Status</h2>
          <StatusBadge color={warRoom.status === "active" ? "red" : "gray"}>
            {warRoom.status === "active" ? "Aktivt" : "Stängt"}
          </StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          Aktiverat {new Date(warRoom.activated_at).toLocaleString("sv-SE")}
        </p>
        {warRoom.status === "active" ? (
          <Button className="mt-3" variant="outline" onClick={() => act("close")} disabled={busy}>
            Stäng war room
          </Button>
        ) : null}

        <h3 className="mt-5 mb-2 text-sm font-semibold">Deadlines</h3>
        <ul className="space-y-1 text-sm">
          {deadlines.length === 0 ? (
            <li className="text-muted-foreground">Inga deadlines.</li>
          ) : (
            deadlines.map((d) => (
              <li key={d.deadline_type} className="flex items-center gap-2">
                <StatusBadge
                  color={d.status === "missed" ? "red" : d.status === "met" ? "green" : "blue"}
                >
                  {d.deadline_type}
                </StatusBadge>
                {new Date(d.due_at).toLocaleString("sv-SE")}
              </li>
            ))
          )}
        </ul>

        <h3 className="mt-5 mb-2 text-sm font-semibold">Rapporter</h3>
        <ul className="space-y-1 text-sm">
          {reports.length === 0 ? (
            <li className="text-muted-foreground">Inga rapporter.</li>
          ) : (
            reports.map((r) => (
              <li key={r.id}>
                <Link href={`/app/reports/${r.id}`} className="text-primary hover:underline">
                  {r.report_stage}
                </Link>{" "}
                <span className="text-muted-foreground">({r.status})</span>
              </li>
            ))
          )}
        </ul>

        <h3 className="mt-5 mb-2 text-sm font-semibold">Bevis</h3>
        <ul className="space-y-1 text-sm">
          {evidence.length === 0 ? (
            <li className="text-muted-foreground">Inga bevis kopplade.</li>
          ) : (
            evidence.map((e) => <li key={e.id}>{e.file_name}</li>)
          )}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">
          Medlemmar ({warRoom.war_room_members.length})
        </h2>
        <ul className="mb-4 space-y-1 text-sm">
          {warRoom.war_room_members.map((m) => (
            <li key={m.id}>
              {m.member_name}
              {m.role ? ` — ${m.role}` : ""}
              {m.is_external ? " (extern)" : ""}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="wr-member">Namn</Label>
            <Input id="wr-member" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wr-role">Roll</Label>
            <Input id="wr-role" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} />
          </div>
          <Button
            variant="outline"
            disabled={busy || !memberName}
            onClick={() => {
              void act("add_member", { memberName, memberRole });
              setMemberName("");
              setMemberRole("");
            }}
          >
            Lägg till
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">
          Beslut ({warRoom.war_room_decisions.length})
        </h2>
        <ul className="mb-4 space-y-2 text-sm">
          {warRoom.war_room_decisions.map((d) => (
            <li key={d.id} className="rounded-lg border p-3">
              <p className="font-medium">{d.decision}</p>
              {d.options_considered ? (
                <p className="text-xs text-muted-foreground">
                  Övervägda alternativ: {d.options_considered}
                </p>
              ) : null}
              {d.selected_option ? (
                <p className="text-xs text-muted-foreground">Valt: {d.selected_option}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Motivering: {d.reason} · Godkänd av {d.approver_name} ·{" "}
                {new Date(d.decided_at).toLocaleString("sv-SE")}
              </p>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <Input
            aria-label="Beslut"
            placeholder="Beslut"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
          />
          <Input
            aria-label="Övervägda alternativ"
            placeholder="Övervägda alternativ"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
          <Input
            aria-label="Valt alternativ"
            placeholder="Valt alternativ"
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
          />
          <Input
            aria-label="Motivering"
            placeholder="Motivering *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Input
            aria-label="Godkännare"
            placeholder="Godkännare *"
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
          />
          <Button
            disabled={busy || !decision || !reason || !approver}
            onClick={() => {
              void act("add_decision", {
                decision,
                optionsConsidered: options,
                selectedOption,
                reason,
                approverName: approver,
              });
              setDecision("");
              setOptions("");
              setSelectedOption("");
              setReason("");
              setApprover("");
            }}
          >
            Registrera beslut
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">
          Uppgifter ({warRoom.war_room_tasks.length})
        </h2>
        <ul className="mb-4 space-y-1 text-sm">
          {warRoom.war_room_tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2">
              <span>
                {t.title}
                {t.assigned_to_name ? (
                  <span className="text-muted-foreground"> · {t.assigned_to_name}</span>
                ) : null}
              </span>
              <StatusBadge color={t.status === "done" ? "green" : "blue"}>{t.status}</StatusBadge>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="wr-task">Uppgift</Label>
            <Input id="wr-task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wr-assignee">Ansvarig</Label>
            <Input id="wr-assignee" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} />
          </div>
          <Button
            variant="outline"
            disabled={busy || !taskTitle}
            onClick={() => {
              void act("add_task", { taskTitle, taskAssignee });
              setTaskTitle("");
              setTaskAssignee("");
            }}
          >
            Lägg till
          </Button>
        </div>

        <h2 className="mt-6 mb-3 text-lg font-semibold">Meddelanden</h2>
        <ul className="mb-3 max-h-60 space-y-2 overflow-y-auto text-sm">
          {[...warRoom.war_room_messages]
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .map((m) => (
              <li key={m.id} className="rounded-lg border px-3 py-2">
                <p>{m.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.created_by_name ?? "Okänd"} · {new Date(m.created_at).toLocaleString("sv-SE")}
                </p>
              </li>
            ))}
        </ul>
        <div className="space-y-2">
          <Textarea
            aria-label="Nytt meddelande"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Meddelande till war room…"
          />
          <Button
            variant="outline"
            disabled={busy || !message.trim()}
            onClick={() => {
              void act("add_message", { message });
              setMessage("");
            }}
          >
            Skicka
          </Button>
        </div>
      </section>
    </div>
  );
}
