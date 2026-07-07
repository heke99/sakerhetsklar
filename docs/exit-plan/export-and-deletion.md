# Exit: export och radering

Kundens data är kundens egendom. Exitprocessen är designad för att vara
komplett, verifierbar och utan inlåsning.

## Exportpaket

Genereras under `/app/export-exit` (eller via API `/api/v1/exports`):

- Omfattningsprofil, klassificering och regelprofil (JSON).
- Kontroller, risker, åtgärdsplaner.
- System-, tjänste- och leverantörsregister (JSON + Excel).
- Incidenter med tidslinjer, bedömningar, rapporter, Cyberportalen-ID och
  kvitton.
- GDPR-bedömningar och IMY-inskick.
- Beslutsloggar (inkl. war room) och sena rapporteringsärenden.
- Bevismanifest med SHA-256-hashar; bevisfiler exporteras från lagringen.
- Manifestfil med antal per sektion och genereringstidpunkt.

## Radering (Model A/B)

1. Kunden begär avslut; avtalad exportperiod börjar (standard 30 dagar).
2. Exportpaket genereras och överlämnas.
3. Tenantens rader raderas (cascade via `tenant_id`), bevisfiler raderas ur
   lagringen, backuper roteras ut enligt backupretention (max 35 dagar).
4. Raderingsintyg utfärdas.
5. Undantag: data under legal hold raderas inte förrän hold släpps av kunden.

## Radering (Model C)

Kunden äger datamiljön; leverantören raderar endast styrplansregistreringen och
eventuella supportkopior. Kunden ansvarar för sin egen datamiljös livscykel.

## Retention

Retentionpolicyer per objekttyp stöds (`retention_policies`). Bevis med
`retention_until` raderas inte före det datumet; legal hold har företräde.
