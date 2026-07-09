# Säkerhetsöversikt — Säkerhetsklar (kundunderlag)

Detta dokument är ett kundvänligt sammandrag för teknisk granskning och
upphandling. Detaljer finns i refererade dokument. Säkerhetsklar
tillhandahåller beslutsstöd — det slutliga juridiska och regulatoriska
ansvaret ligger kvar hos organisationen.

## Arkitektur och tenantisolering

- Multi-tenant SaaS (Model A) med isolering i tre lager:
  1. **Applikationslager**: varje API-anrop auktoriseras mot användarens
     tenantmedlemskap och behörigheter; resurs-ID:n verifieras alltid mot
     ägande tenant på serversidan.
  2. **Radnivåskydd (RLS)** på samtliga tenanttabeller i databasen.
  3. **Sammansatta främmande nycklar** `(tenant_id, id)` gör korstenanta
     relationer omöjliga även vid direkta databasfel/administrativa misstag.
- Isolerade driftmodeller: Model B (egen databas, leverantörsdriftad) och
  Model C (kundägd datamiljö). Otillräckligt provisionerade B/C-miljöer
  **nekas åtkomst helt (fail closed)** — data hamnar aldrig i den delade
  databasen av misstag. Se `docs/deployment-models.md`.

## Autentisering och åtkomst

- Supabase Auth med lösenordspolicy (min 12 tecken vid kontoskapande),
  fungerande lösenordsåterställning och inbjudningsflöde med hashade,
  tidsbegränsade engångstoken (aldrig råtoken i produktions-API:er).
- Per-tenant authkrav: SSO-krav blockerar lösenordsinloggning för vanliga
  användare; MFA-krav blockerar sessioner under AAL2. Båda fail closed.
- RBAC med 14 tenantroller + plattformsroller; plan-/funktionsåtkomst styrs
  av en entitlementsmotor som nekar allt som inte uttryckligen beviljats.

## Supportåtkomst och insyn

- Superadmin ser driftmetadata — inte incident-/bevisinnehåll.
- Supportåtkomst är explicit, tidsbegränsad (max 72h), syftesangiven och
  kräver kundens godkännande. Omfattning (läs/skriv, bevis, export) styrs per
  ärende och **all användning loggas**, inklusive nekade försök.
  Se `docs/security/support-access.md`.
- Break-glass-nödåtkomst är entitlementstyrd, skälkrävande, tidsbegränsad och
  notifierar kundens administratörer.

## Bevis och spårbarhet

- Privat lagring, enbart signerade URL:er (5 min), SHA-256-hash, versioner,
  åtkomstlogg och spårbarhetskedja per fil.
- Filtypskontroll (allowlist + blockerade körbara filer), planbaserade
  storleksgränser, valfri malware-skanning som fail closed när den krävs.
- Legal hold blockerar radering på databasnivå (triggrar) — även för
  administratörer.
- Fullständig auditlogg för känsliga åtgärder; separata åtkomst-/export-/
  nedladdningsloggar.

## Regelverk och juridik

- Alla legala regler är versionerade databärare med källmyndighet, officiell
  källänk, ikraftträdande, täckningsstatus och verifieringsstämpel
  (`last_verified_at`). Osäkra tolkningar returnerar alltid
  "manuell bedömning krävs" — aldrig gissningar.

## Drift

- Hälso-/readinessändpunkter, strukturerad JSON-loggning, CI med säkerhets-
  och migrationstester, dokumenterad backup/restore och datalivscykel
  (`docs/runbooks/`), beroendegranskningar (`docs/security/dependency-audit.md`).
- Underbiträden: se `docs/procurement/subprocessors.md`. Personuppgifts-
  biträdesavtal: se `docs/procurement/dpa-pub-appendix.md`.
