# Model C — Kundägd datamiljö

I Model C äger kunden hela datamiljön: databas, lagring, nycklar, revisionslogg,
backuper och bevisbank. Leverantören tillhandahåller applikation/styrplan,
releasepaket, SQL-migrationer, regelmallar, support och uppdateringar.

## Varianter

- **C1 — kundägd managed Supabase**: kunden äger Supabase-organisationen och
  projektet; leverantören får (tidsbegränsad, loggad) åtkomst endast för
  releaser/support efter godkännande.
- **C2 — självhostad Supabase**: kunden driftar Supabase-stacken i egen miljö.
- **C3 — egen Postgres + separat lagring + leverantörsbackend**: kunden driftar
  Postgres och objektlagring; applikationen ansluter via kundens
  anslutningsreferenser.

## Ansvarsfördelning (sammanfattning)

| Område | Kund | Leverantör |
| --- | --- | --- |
| Datamiljö (DB/Storage) | Äger och driftar | Levererar migrationsfiler |
| Kryptonycklar | Äger | – |
| Backup/restore | Äger | Runbook + verifieringsstöd |
| Applikationsreleaser | Godkänner | Levererar releasepaket |
| Regeluppdateringar | Godkänner | Publicerar versionerade regelpaket |
| Support | Godkänner åtkomst | Utför enligt godkännande |

## Krav på kundmiljön

- PostgreSQL 15+ med RLS aktiverat, applicerade migrationer i ordning.
- Objektlagring med signerade URL:er för bevis.
- Hemligheter i kundens hemlighetshanterare; appservern läser referenser.
- Nätverksåtkomst från applikationsservern till datamiljön.

## Vad styrplanen ser

Endast: tenantregistrering, domän, aktiverade moduler, versionsstatus,
hälsostatus (upp/ner), produktionsberedskap. Aldrig verksamhetsdata.

## Exit

Kunden äger redan all data. Exitpaketet (`/app/export-exit`) ger komplett
strukturerad export; leverantörens applikationsåtkomst stängs av och eventuella
cachade konfigurationer raderas. Se `docs/exit-plan/export-and-deletion.md`.
