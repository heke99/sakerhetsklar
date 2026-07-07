# Kryptering och nyckelhantering

## Data i transit

All trafik sker över TLS 1.2+. Interna anrop mellan applikation och datamiljö
sker över krypterade kanaler.

## Data i vila

- Model A/B: kryptering i vila via den underliggande plattformen (managed
  Postgres/objektlagring).
- Model C: kunden ansvarar för kryptering i vila i sin egen miljö och äger
  nycklarna (C1: kundens Supabase-projekt; C2: självhostad Supabase; C3: egen
  Postgres + lagring).

## BYOK / KMS

För Enterprise/Model C stöds kundägda nycklar eller nyckelreferenser. Nycklar
lagras aldrig i Säkerhetsklars styrplan — endast referenser (miljövariabel-/
hemlighetsnamn) som löses upp server-side.

## Hemligheter

- Service role-nycklar exponeras aldrig till frontend.
- `tenant_data_plane_connections` lagrar endast hemlighetsreferenser
  (`service_role_key_ref`, `db_url_ref`), aldrig råa värden.
- Webhook-signeringsnycklar och jobbhemligheter är server-side-miljövariabler.

## Hashning

Bevisfiler hashas med SHA-256 vid uppladdning; hasharna ingår i bevismanifestet
i tillsyns- och exitpaketen.
