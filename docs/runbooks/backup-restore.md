# Runbook: backup och restore

## Ansvar per driftmodell

- **Model A/B**: leverantören ansvarar för databas- och lagringsbackuper.
- **Model C**: kunden äger backuperna; leverantören tillhandahåller denna
  runbook och verifieringsstöd.

## Backup

- Databas: daglig full backup + PITR (point-in-time recovery) där plattformen
  stöder det. Retention: 35 dagar (konfigurerbart per kund i Model B).
- Objektlagring (bevis): versionering + daglig synk till sekundär hink.
- Backupstatus registreras per tenant i `tenant_backup_status` och visas i
  `/platform/health`.

## Restore-test

- Kvartalsvis återläsningstest per miljö; resultat registreras i
  `restore_tests` och i styrplanen (`last_restore_test_at`).
- Testet omfattar: databasåterläsning till isolerad miljö, verifiering av
  RLS-policyer, stickprov av bevisfilers hashar mot `evidence_hashes`.

## Restore-procedur (Model A/B)

1. Bekräfta omfattning (hel databas eller enskild tenant).
2. Återläs till isolerad miljö; verifiera datamängd + hashar.
3. För enskild tenant: exportera tenantens rader (per `tenant_id`) och importera
   till produktion inom transaktion; kör isoleringstester.
4. Dokumentera i revisionsloggen och informera kunden.

## Bevisbankens integritet

Efter varje återläsning verifieras bevisfiler mot lagrade SHA-256-hashar.
Avvikelser eskaleras som SEV1 (dataintegritet).
