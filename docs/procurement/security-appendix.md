# Säkerhetsbilaga — Säkerhetsklar

Detta dokument är en mall för säkerhetsbilaga vid upphandling av Säkerhetsklar.
Säkerhetsklar tillhandahåller beslutsstöd — det slutliga juridiska och regulatoriska
ansvaret ligger kvar hos organisationen.

## Arkitektur och isolering

- Tre driftmodeller: delad SaaS (Model A), single-tenant (Model B) och kundägd
  datamiljö (Model C). Se `docs/deployment-models.md`.
- Model A: strikt tenantisolering med `tenant_id` + Row Level Security (RLS) i
  PostgreSQL. Verifieras med automatiska isoleringstester.
- Model B/C: separat databas, lagring, nycklar och backuper per kund.
- Central styrplan (control plane) innehåller aldrig incidentinnehåll,
  bevisinnehåll, rapporttexter eller personuppgiftsincidentdata.

## Åtkomstkontroll

- RBAC med plattforms- och tenantroller samt ABAC-policyer (attributbaserade,
  deny-överstyr-allow, fail closed).
- MFA stöds; SSO via Entra ID/OIDC/SAML för Enterprise.
- Supportåtkomst kräver kundens godkännande, är ändamålsbunden, tidsbegränsad,
  fullständigt loggad och återkallbar. Export kräver separat godkännande.
- Break-glass-nödåtkomst kräver skäl, är tidsbegränsad, loggas och notifierar
  kundens administratörer.

## Loggning och spårbarhet

- Alla kritiska åtgärder skrivs till revisionslogg (aktör, åtgärd, före/efter,
  skäl, IP, tidpunkt).
- Bevisbank med SHA-256-hashar, versionshistorik, åtkomstlogg och
  spårbarhetskedja (chain of custody). Legal hold stöds.
- Anomalidetektering för känslig åtkomst, massnedladdning och exportförsök.

## Kryptering

- TLS för data i transit. Kryptering i vila via underliggande molnplattform.
- Model C: kunden äger nycklar eller nyckelreferenser (BYOK/KMS där tillämpligt).
- Servicenycklar exponeras aldrig till frontend; hemligheter lagras som
  referenser till hemlighetshanterare.

## Sårbarhets- och incidenthantering

- Se `docs/runbooks/platform-incident-response.md`.
- Plattformsincidenter som påverkar kund rapporteras enligt avtalad SLA.

## Säkerhetsskyddsklassificerade uppgifter

Säkerhetsskyddsklassificerade uppgifter får inte laddas upp om inte kundens
deployment och hanteringsprocess är godkänd för den typen av information.
