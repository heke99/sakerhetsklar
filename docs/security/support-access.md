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
- Export under supportsession kräver separat `allow_export`-flagga (ABAC-policy
  nekar annars).

## Synlighet

- Kund: `/app/access-review` visar alla förfrågningar och beslut.
- Plattform: `/platform/support-access` visar samtliga förfrågningar och status.
- Åtkomstgranskningsrapporten inkluderar supportåtkomsthistorik.
