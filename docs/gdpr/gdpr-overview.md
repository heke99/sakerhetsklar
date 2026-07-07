# GDPR i Säkerhetsklar

## Två perspektiv

1. **Plattformens egen GDPR-efterlevnad** (Säkerhetsklar som biträde):
   se `docs/procurement/dpa-pub-appendix.md`, `subprocessors.md`,
   `data-residency.md`, `third-country-transfer.md` samt
   `docs/exit-plan/export-and-deletion.md`.
2. **Kundens GDPR-arbete i plattformen**: GDPR/IMY-spåret för
   personuppgiftsincidenter.

## GDPR/IMY-spåret

- Varje incident ställer frågan "Finns personuppgifter?".
- GDPR-bedömningen är **separat** från NIS2-rapporteringen och slås aldrig ihop.
- 72-timmarsfristen till IMY räknas från kännedom om anmälningspliktig incident
  (`awareness_at` → `imy_deadline_at`).
- Beslut att **inte** anmäla kräver dokumenterad motivering och godkännare.
- DPO-godkännande registreras på bedömningen.
- IMY-inskick registreras med referens och kvitto.
- Information till registrerade hanteras som eget beslut med utkast och
  godkännande.

## Dataminimering i plattformen

- Seed-/demodata innehåller inga riktiga personuppgifter.
- Styrplanen innehåller ingen personuppgiftsincidentdata.
- Revisionsloggar innehåller reducerade payloads — aldrig bevisinnehåll eller
  incidentinnehåll i klartext utöver rubriker.
