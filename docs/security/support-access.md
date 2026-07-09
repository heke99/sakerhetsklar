# Supportåtkomstprocess

Supportåtkomst till tenantdata följer principen: ingen åtkomst utan kundens
godkännande.

## Process

1. Supportpersonal (plattformsroll `support_admin` m.fl.) skapar en
   åtkomstförfrågan med **syfte**, **omfattning** (läs/skriv), om **bevis** får
   läsas och om **export** får ske, samt varaktighet (max 72 h).
2. Kundens `tenant_admin` eller `ciso` godkänner eller nekar förfrågan.
3. Godkänd åtkomst är tidsbegränsad och upphör automatiskt vid utgång.
4. All användning loggas (`support_access_logs` + revisionslogg).
5. Kunden kan återkalla åtkomsten när som helst (skäl krävs).

## Tekniskt genomförande

- RLS-funktionen `app.has_support_access(tenant_id)` ger endast åtkomst när en
  godkänd, ej utgången förfrågan finns.
- Plattformsadministratörer har **inte** blanket-åtkomst till tenantdata —
  endast styrplansmetadata.
- Tjänstelagret (`src/lib/authz/support-guards.ts`) verkställer omfattningen
  för supportsessioner: `include_evidence` krävs för bevisnedladdning/-uppladdning,
  `scope=read_write` för skrivande bevisåtgärder och `allow_export` för
  samtliga exporter (styrelserapport, tillsynspaket, Excel, upphandlingspaket,
  rapportexport). Både tillåtna och **nekade** försök loggas i
  `support_access_logs`.
- Supportåtkomst begärs från plattformens tenantprofil
  (`/platform/tenants/{id}`) och godkänns/nekas/återkallas av kundens
  tenantadmin/CISO i `/app/access-review`.

## Synlighet

- Kund: `/app/access-review` visar alla förfrågningar och beslut.
- Plattform: `/platform/support-access` visar samtliga förfrågningar och status.
- Åtkomstgranskningsrapporten inkluderar supportåtkomsthistorik.
