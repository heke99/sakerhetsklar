# Runbook: plattformsincidenter (Säkerhetsklar självt)

Gäller incidenter i Säkerhetsklar-plattformen (inte kundernas incidenter).

## Allvarlighetsgrader

- **SEV1**: total otillgänglighet eller dataintegritetsproblem i produktion.
- **SEV2**: väsentlig funktionsnedsättning (t.ex. rapportmodulen nere).
- **SEV3**: begränsad påverkan/workaround finns.

## Flöde

1. **Upptäckt**: larm (hälsokontroller, `tenant_health_checks`) eller kundrapport.
2. **Bekräfta och klassificera** (SEV1–3), utse incidentledare.
3. **Kommunicera**: statusuppdatering till berörda kunder enligt SLA; för SEV1
   inom 60 minuter.
4. **Åtgärda**: mitigering före rotorsak; ändringar via ordinarie release- och
   rollbackrutin (`release-and-rollback.md`).
5. **Kundpåverkansbedömning**: om kunddata kan ha exponerats — informera
   berörda kunder utan onödigt dröjsmål så att de kan fullgöra egna
   rapporteringsskyldigheter (NIS2/GDPR). Kom ihåg: kundernas 24h/72h-frister
   kan aktiveras av vår incident.
6. **Efterarbete**: incidentrapport inom 5 arbetsdagar, åtgärdsplan, uppdatera
   runbooks.

## Viktiga kontroller under incident

- Tenantisolering får aldrig kringgås för felsökning utan godkänd
  supportåtkomst eller break-glass (loggas).
- Inga hemligheter i loggar eller ärenden.
- Alla nödåtgärder revisionsloggas.
