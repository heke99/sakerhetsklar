# Runbook: release och rollback

## Releaseflöde

1. PR med grön CI: typecheck, lint, enhetstester, migrations- och RLS-tester
   (`scripts/db-test.sh`).
2. Migrationer är expand-migrate-contract för riskabla ändringar:
   - **Expand**: additiva kolumner/tabeller, bakåtkompatibla.
   - **Migrate**: datafyllnad i bakgrund.
   - **Contract**: borttagning först i senare release när ingen kod läser det gamla.
3. Release till stage → verifiering → produktion.
4. Model B/C: releasepaket + migrationer rullas ut per tenant; status spåras i
   `tenant_release_status` och `tenant_migration_status` och visas i
   `/platform/release-status`.
5. Regelpaketversioner publiceras separat via regeladmin (`/platform/rules`) och
   påverkar tenants först vid tilldelning.

## Rollback

- Applikation: föregående build aktiveras (blue/green eller plattformens
  versionshantering).
- Databas: framåtfix föredras. Tack vare expand-migrate-contract är
  applikationsrollback säker mot senaste migrationssteget.
- Regelpaket: tidigare version finns kvar i `regulatory_rule_versions`; en
  tenant kan pekas tillbaka till tidigare version utan kodändring.
- Alla rollbacks loggas i revisionsloggen och i `tenant_release_status`
  (`rolled_back`).

## Produktionsberedskap per tenant

Nya tenants släpps inte till produktion förrän gaterna i
`tenant_production_readiness` är gröna: auth konfigurerad, domän verifierad,
RLS verifierad, backup verifierad, regelprofil tilldelad, incidentroller
utsedda, onboarding klar.
