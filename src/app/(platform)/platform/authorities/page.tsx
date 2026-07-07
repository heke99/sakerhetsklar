import { PageHeader } from "@/components/app/page-header";
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
export const metadata = { title: "Authorities" };

export default async function AuthoritiesPage() {
  await requirePlatformRole();
  const admin = getAdminClient();

  const { data: authorities } = await admin
    .from("supervisory_authorities")
    .select("*, sector_supervisory_authorities(sector_code)")
    .order("name_sv");

  return (
    <main className="p-8">
      <PageHeader
        title="Supervisory authorities"
        description="Authority registry with sector mappings and regional logic."
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Authority</TableHead>
              <TableHead>Regional</TableHead>
              <TableHead>Sectors</TableHead>
              <TableHead>Website</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(authorities ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-medium">{a.name_sv}</p>
                  <p className="font-mono text-xs text-muted-foreground">{a.code}</p>
                </TableCell>
                <TableCell>{a.is_regional ? "Ja" : "Nej"}</TableCell>
                <TableCell className="max-w-md text-sm">
                  {(
                    (a.sector_supervisory_authorities as { sector_code: string }[]) ?? []
                  )
                    .map((m) => m.sector_code)
                    .join(", ") || "–"}
                </TableCell>
                <TableCell className="text-sm">
                  {a.website ? (
                    <a
                      href={a.website}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.website}
                    </a>
                  ) : (
                    "–"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
