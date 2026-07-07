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
import { requirePlatformRole } from "@/lib/services/require-platform";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sectors" };

export default async function SectorsPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const [sectorsRes, subsectorsRes, mappingsRes] = await Promise.all([
    admin.from("sectors").select("*").order("code"),
    admin.from("subsectors").select("*"),
    admin.from("sector_supervisory_authorities").select("*, supervisory_authorities(name_sv)"),
  ]);

  const subsBySector = new Map<string, string[]>();
  for (const ss of subsectorsRes.data ?? []) {
    const list = subsBySector.get(ss.sector_code) ?? [];
    list.push(ss.name_sv);
    subsBySector.set(ss.sector_code, list);
  }
  const authBySector = new Map<string, string[]>();
  for (const m of mappingsRes.data ?? []) {
    const list = authBySector.get(m.sector_code) ?? [];
    const name =
      (m.supervisory_authorities as unknown as { name_sv: string } | null)?.name_sv ??
      m.authority_code;
    if (!list.includes(name)) list.push(name);
    authBySector.set(m.sector_code, list);
  }

  return (
    <main className="p-8">
      <PageHeader
        title="Sectors"
        description="All 18 NIS2 sectors with annex, subsectors and supervisory authority mapping."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sector</TableHead>
              <TableHead>Annex</TableHead>
              <TableHead>Subsectors</TableHead>
              <TableHead>Supervisory authorities</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sectorsRes.data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-medium">{s.name_sv}</p>
                  <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge color={s.annex === "annex_1" ? "blue" : "gray"}>
                    {s.annex === "annex_1" ? "Bilaga 1" : "Bilaga 2"}
                  </StatusBadge>
                </TableCell>
                <TableCell className="max-w-md text-sm">
                  {(subsBySector.get(s.code) ?? []).join(", ") || "–"}
                </TableCell>
                <TableCell className="text-sm">
                  {(authBySector.get(s.code) ?? []).join(", ") || "–"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
