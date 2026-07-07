# Model B — Single-tenant / isolerad leverantörsdriftad datamiljö

Model B ger varje kund en egen, isolerad datamiljö som driftas av leverantören.
Lämplig för kommuner, energi, VA, offentlig sektor och kunder med förhöjda krav.

## Vad som är separat per kund

- Eget Supabase-projekt (eller motsvarande): databas, Auth, Storage och (där
  tillämpligt) Edge Functions.
- Egna RLS-policyer (samma migrationsuppsättning som Model A).
- Egna API-nycklar och hemligheter.
- Egna backuper och egna test-/stage-/prod-miljöer.

## Styrplanens roll

Styrplanen innehåller endast: tenantregistret, domäner, miljöer, aktiverade
moduler, versioner, migrationsstatus, hälsostatus, produktionsberedskap och
supportärendemetadata. **Ingen** incidentdata, bevis, rapporttexter eller
personuppgiftsincidentinnehåll.

## Provisionering

1. Skapa tenant i styrplanen med `deployment_model = 'single_tenant'`.
2. Provisionera Supabase-projekt i vald EU-region; kör migrationsfilerna i
   `supabase/migrations/` i ordning samt relevanta seedfiler.
3. Registrera `tenant_data_plane_connections` med URL + publishable key och
   **hemlighetsreferenser** (miljövariabelnamn) för service role/DB URL.
4. Registrera domän i `tenant_domains` (t.ex. `kund.sakerhetsklar.se`).
5. Konfigurera auth-provider i `tenant_auth_providers`.
6. Kör produktionsberedskapsgaterna (`tenant_production_readiness`).

## Routing

Tenantresolvern slår upp domänen, verifierar tenant- och datamiljöstatus och
returnerar endast säker (icke-hemlig) konfiguration. Okända domäner nekas
(fail closed). Miljö-mismatch mellan domän och datamiljö nekas.

## Uppgraderingar

Release- och migrationsstatus per tenant spåras i styrplanen
(`tenant_release_status`, `tenant_migration_status`) och visas i
`/platform/release-status`. Expand-migrate-contract används för riskabla
schemaändringar.
