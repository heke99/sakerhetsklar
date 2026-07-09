import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { MarkAllReadButton, NotificationLink } from "./notification-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notiser" };

export default async function NotificationsPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { actor } = current;

  const admin = getAdminClient();
  const { data: notifications } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <main className="p-8">
      <PageHeader
        title="Notiser"
        description="Deadlinepåminnelser, eskalationer och viktiga händelser."
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} olästa notiser.` : "Alla notiser är lästa."}
        </p>
        {unreadCount > 0 ? <MarkAllReadButton /> : null}
      </div>

      <div className="space-y-2">
        {(notifications ?? []).length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Inga notiser ännu. Här visas deadlinepåminnelser, eskalationer och
            viktiga händelser i incident- och rapporteringsflödet.
          </div>
        ) : (
          (notifications ?? []).map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border bg-card p-4 ${n.read_at ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    color={
                      n.severity === "critical"
                        ? "red"
                        : n.severity === "warning"
                          ? "yellow"
                          : "blue"
                    }
                  >
                    {n.severity === "critical"
                      ? "Kritisk"
                      : n.severity === "warning"
                        ? "Varning"
                        : "Info"}
                  </StatusBadge>
                  <span className="font-medium">{n.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("sv-SE")}
                </span>
              </div>
              {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
              {n.link_path ? (
                <NotificationLink notificationId={n.id} href={n.link_path} read={Boolean(n.read_at)} />
              ) : null}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
