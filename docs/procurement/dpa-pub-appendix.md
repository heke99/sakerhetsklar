# Personuppgiftsbiträdesavtal (PUB/DPA) — bilaga, mall

Mall för personuppgiftsbiträdesbilaga för Säkerhetsklar. Anpassas per kund och
driftmodell innan avtal ingås.

## Roller

- Kunden är personuppgiftsansvarig för uppgifter i tenantens data.
- Leverantören av Säkerhetsklar är personuppgiftsbiträde (Model A/B).
- I Model C (kundägd datamiljö) behandlar leverantören endast personuppgifter i
  supportärenden efter kundens godkännande.

## Behandlingens art och ändamål

- Tillhandahållande av compliance-, incident- och rapporteringsplattform.
- Kategorier: användaruppgifter (namn, e-post, roller), incidentdata som kunden
  registrerar, bevisfiler som kunden laddar upp.
- Inga uppgifter används för andra ändamål än tjänstens tillhandahållande.

## Instruktioner

- Behandling sker endast enligt dokumenterade instruktioner (avtalet + tjänstens
  konfiguration).
- Supportåtkomst kräver godkännande per tillfälle och loggas.

## Säkerhetsåtgärder

Se säkerhetsbilagan (`security-appendix.md`): RLS-tenantisolering, RBAC/ABAC,
MFA/SSO, revisionsloggar, kryptering, anomalidetektering, backup/restore.

## Underbiträden

Aktuell lista i `subprocessors.md`. Kunden informeras före förändringar och kan
invända enligt avtalet.

## Tredjelandsöverföring

Se `third-country-transfer.md`. Standardleverans sker inom EU/EES.

## Radering och retention

- Vid avtalets upphörande exporteras kundens data (exitpaket) och raderas enligt
  `docs/exit-plan/export-and-deletion.md`.
- Retentionpolicyer per objekttyp stöds; legal hold undantar radering.

## Personuppgiftsincidenter

Biträdet underrättar den ansvarige utan onödigt dröjsmål efter kännedom om en
personuppgiftsincident som rör kundens data, med den information som krävs för
kundens IMY-bedömning (72-timmarsfristen är kundens).
