import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentTenant } from "@/lib/services/current-tenant";
import { EXERCISE_STATUS_SV, svLabel } from "@/lib/labels/sv";
import { getAdminClient } from "@/lib/server/supabase-admin";

import { ExerciseControls } from "./exercise-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Övningar" };

export default async function ExercisesPage() {
  const current = await getCurrentTenant();
  if (!current) redirect("/login");
  const { tenant } = current;

  const admin = getAdminClient();
  const [scenariosRes, runsRes] = await Promise.all([
    admin.from("exercise_scenarios").select("*").order("code"),
    admin
      .from("exercise_runs")
      .select("*, exercise_scenarios(title_sv), exercise_findings(*)")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="p-8">
      <PageHeader
        title="Tabletop-övningar"
        description="Öva incidenthantering och rapportering. Mät tid till klassificering och rapportutkast, dokumentera fynd och åtgärdsplaner."
      />

      <ExerciseControls
        tenantId={tenant.id}
        scenarios={(scenariosRes.data ?? []).map((s) => ({
          code: s.code,
          title: s.title_sv,
          description: s.description_sv,
        }))}
        activeRun={(runsRes.data ?? []).find((r) => r.status === "in_progress") ?? null}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Genomförda övningar</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tid till klassificering</TableHead>
                <TableHead>Tid till rapportutkast</TableHead>
                <TableHead>Poäng</TableHead>
                <TableHead>Fynd</TableHead>
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runsRes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Inga övningar genomförda ännu.
                  </TableCell>
                </TableRow>
              ) : (
                (runsRes.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {(r.exercise_scenarios as unknown as { title_sv: string } | null)?.title_sv ?? "–"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        color={
                          r.status === "completed"
                            ? "green"
                            : r.status === "in_progress"
                              ? "blue"
                              : "gray"
                        }
                      >
                        {svLabel(EXERCISE_STATUS_SV, r.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {r.minutes_to_classify !== null ? `${r.minutes_to_classify} min` : "–"}
                    </TableCell>
                    <TableCell>
                      {r.minutes_to_draft_report !== null
                        ? `${r.minutes_to_draft_report} min`
                        : "–"}
                    </TableCell>
                    <TableCell>{r.score ?? "–"}</TableCell>
                    <TableCell>{((r.exercise_findings as unknown[]) ?? []).length}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString("sv-SE")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
