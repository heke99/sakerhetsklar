# Runbook: datalivscykel — retention, radering, suspension, legal hold och exit

Uppdaterad i production-readiness batch 18. Detta dokument knyter ihop de
tekniska spärrarna i koden/databasen med de operativa rutinerna.

## Suspension (paus/inaktivering)

- Superadmin sätter tenantstatus `paused`/`disabled` i `/platform/tenants/{id}`
  (Management-sektionen). Ändringen kräver bekräftelse och auditloggas
  (`tenant.updated`).
- `getCurrentTenant` nekar åtkomst för `disabled` tenants; inloggade användare
  förlorar åtkomst till innehållet.

## Tenantradering (deliberate, auditerad, legal hold-blockerad)

- `DELETE /api/v1/tenants/{id}` — endast `platform_owner`.
- Kräver att organisationens exakta namn skrivs in (`confirmName`) samt en
  dokumenterad orsak (`reason`, min 10 tecken).
- **Blockeras med 409 när tenanten har aktiva legal holds.**
- Utförs som soft delete (`deleted_at` + status `disabled`) och auditloggas
  som `tenant.deleted` med orsak. Slutlig utrensning (purge) görs manuellt
  enligt avtalad exitplan efter exportleverans — aldrig automatiskt.

## Legal hold

- Läggs per incident/utredning i `legal_holds` med koppling till bevis via
  `legal_hold_items` (tenant-komposit-FK sedan migration 0019).
- **Databastriggrar (migration 0023) blockerar både hård och mjuk radering av
  bevis** som är flaggade `legal_hold` eller ingår i en aktiv hold — även för
  service-rollen och manuell SQL.
- Tenantradering blockeras på API-nivå så länge aktiva holds finns (ovan).

## Retention

- Bevisretention styrs av `tenant_settings.evidence_retention_days`
  (standard 1825 dagar) och `retention_policies`; `evidence.retention_until`
  visas i bevisbanken ("Bevarande").
- Retention får aldrig radera bevis under legal hold — detta garanteras av
  triggrarna i 0023, oavsett hur retentionjobbet implementeras/körs.
- Auditloggar och åtkomstloggar omfattas inte av bevisretention och bevaras
  enligt avtal (rekommenderat minimum: 24 månader).

## Tenantexport / exitpaket

- `GET /api/v1/exports?type=supervisory-package` producerar ett ZIP med
  20 strukturerade JSON-sektioner (scope, klassificering, regelpaket,
  kontroller, risker, system, tjänster, leverantörer, incidenter,
  bedömningar, rapporter med fält, Cyberportalen-ID:n, kvitton, beslut,
  GDPR-bedömningar m.m.) samt **bevismanifest med SHA-256-hashar**.
- Bevisfiler levereras via signerade URL:er eller bulkexport från lagringen
  (Model A/B: leverantören; Model C: kunden äger lagringen).
- Export kräver `exports.generate`-behörighet och auditloggas; support-
  åtkomst utan `allow_export` nekas och loggas.

## Ansvarsfördelning per driftmodell

| Moment | Model A (delad) | Model B (isolerad, leverantörsdriftad) | Model C (kundägd) |
| --- | --- | --- | --- |
| Backup/restore | Leverantören | Leverantören | Kunden (runbook tillhandahålls) |
| Retention-körning | Leverantören | Leverantören | Kunden |
| Legal hold-spärr (DB-trigger) | Ja | Ja (migrationer körs per plan) | Ja (kund kör migrationer) |
| Exportpaket | Plattformen | Plattformen | Plattformen (mot kundens plan) |
| Slutlig purge efter exit | Leverantören + intyg | Leverantören + intyg | Kunden |

Se även: `docs/runbooks/backup-restore.md`, `docs/exit-plan/export-and-deletion.md`,
`docs/gdpr/retention-policy.md`, `docs/procurement/subprocessors.md` (underbiträdeslista),
`docs/procurement/dpa-pub-appendix.md` (PUB/DPA-underlag).
