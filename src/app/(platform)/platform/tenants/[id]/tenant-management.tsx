"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Platform-side tenant lifecycle controls: plan, status (pause/suspend),
 * deployment model (fail-closed guard in the API) and support-access
 * requests. All changes are audited server-side.
 */
export function TenantManagement({
  tenantId,
  currentPlan,
  currentStatus,
  currentDeploymentModel,
}: {
  tenantId: string;
  currentPlan: string;
  currentStatus: string;
  currentDeploymentModel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [deploymentModel, setDeploymentModel] = useState(currentDeploymentModel);

  const [supportPurpose, setSupportPurpose] = useState("");
  const [supportScope, setSupportScope] = useState("read_only");
  const [supportHours, setSupportHours] = useState("8");
  const [includeEvidence, setIncludeEvidence] = useState(false);
  const [allowExport, setAllowExport] = useState(false);

  async function patchTenant(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Change failed.");
        return;
      }
      setNotice("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function requestSupportAccess(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/support-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          purpose: supportPurpose,
          scope: supportScope,
          durationHours: Number(supportHours),
          includeEvidence,
          allowExport,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Request failed.");
        return;
      }
      setSupportPurpose("");
      setNotice("Support access requested — awaiting tenant approval.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="mgmt-plan">Plan</Label>
          <div className="flex gap-2">
            <select
              id="mgmt-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={busy || plan === currentPlan}
              onClick={() => void patchTenant({ plan })}
            >
              Set
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mgmt-status">Status</Label>
          <div className="flex gap-2">
            <select
              id="mgmt-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="disabled">Disabled</option>
            </select>
            <Button
              type="button"
              variant={status === "active" ? "outline" : "destructive"}
              disabled={busy || status === currentStatus}
              onClick={() =>
                void patchTenant(
                  { status },
                  status !== "active"
                    ? `Set tenant status to "${status}"? Users will lose access while the tenant is not active.`
                    : undefined,
                )
              }
            >
              Set
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mgmt-model">Deployment model</Label>
          <div className="flex gap-2">
            <select
              id="mgmt-model"
              value={deploymentModel}
              onChange={(e) => setDeploymentModel(e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="multi_tenant">A — Shared SaaS</option>
              <option value="single_tenant">B — Single tenant (requires provisioned plane)</option>
              <option value="customer_owned">C — Customer owned (requires provisioned plane)</option>
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={busy || deploymentModel === currentDeploymentModel}
              onClick={() =>
                void patchTenant(
                  { deploymentModel },
                  deploymentModel !== "multi_tenant"
                    ? "Switching to Model B/C requires an active provisioned data-plane connection. The change is rejected if the plane is not ready. Continue?"
                    : "Switch back to the shared (Model A) plane?",
                )
              }
            >
              Set
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Model B/C fails closed: without a ready data plane the change is rejected.
          </p>
        </div>
      </div>

      <form onSubmit={requestSupportAccess} className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Request support access</h3>
        <p className="text-xs text-muted-foreground">
          Support access is explicit, time-limited, reason-based and requires
          tenant approval. All use is logged.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="support-purpose">Purpose (min 10 chars)</Label>
            <Input
              id="support-purpose"
              value={supportPurpose}
              onChange={(e) => setSupportPurpose(e.target.value)}
              placeholder="e.g. Investigate reported issue with deadline escalations (ticket #123)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-scope">Scope</Label>
            <select
              id="support-scope"
              value={supportScope}
              onChange={(e) => setSupportScope(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="read_only">Read only</option>
              <option value="read_write">Read/write</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-hours">Duration (hours, max 72)</Label>
            <Input
              id="support-hours"
              type="number"
              min={1}
              max={72}
              value={supportHours}
              onChange={(e) => setSupportHours(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeEvidence}
              onChange={(e) => setIncludeEvidence(e.target.checked)}
            />
            Include evidence content
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowExport}
              onChange={(e) => setAllowExport(e.target.checked)}
            />
            Allow exports
          </label>
        </div>
        <Button type="submit" disabled={busy || supportPurpose.length < 10}>
          {busy ? "Sending…" : "Request support access"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
