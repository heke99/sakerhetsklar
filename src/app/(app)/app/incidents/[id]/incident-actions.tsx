"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IncidentActions({
  tenantId,
  incidentId,
  currentStatus,
}: {
  tenantId: string;
  incidentId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  async function changeStatus() {
    setBusy(true);
    try {
      await fetch(`/api/v1/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, status, reason: reason || undefined }),
      });
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/incidents/${incidentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, body: comment }),
      });
      setComment("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/incidents/${incidentId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          title: taskTitle,
          assignedToName: taskAssignee || undefined,
        }),
      });
      setTaskTitle("");
      setTaskAssignee("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="mb-3 text-lg font-semibold">Ändra status</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ia-status">Status</Label>
            <select
              id="ia-status"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="new">Ny</option>
              <option value="triage">Triage</option>
              <option value="investigating">Utreds</option>
              <option value="contained">Begränsad</option>
              <option value="resolved">Löst</option>
              <option value="closed">Stängd</option>
            </select>
          </div>
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="ia-reason">Anledning</Label>
            <Input
              id="ia-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Valfri motivering"
            />
          </div>
          <Button onClick={changeStatus} disabled={busy || status === currentStatus}>
            Uppdatera
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Ny uppgift</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="ia-task">Uppgift</Label>
            <Input
              id="ia-task"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="ex. Kontakta leverantörens incidentjour"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ia-assignee">Ansvarig</Label>
            <Input
              id="ia-assignee"
              value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value)}
            />
          </div>
          <Button onClick={addTask} disabled={busy || !taskTitle.trim()} variant="outline">
            Lägg till
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Kommentar</h2>
        <div className="space-y-3">
          <Textarea
            aria-label="Ny kommentar"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anteckning till tidslinjen…"
          />
          <Button onClick={addComment} disabled={busy || !comment.trim()} variant="outline">
            Lägg till kommentar
          </Button>
        </div>
      </div>
    </section>
  );
}
