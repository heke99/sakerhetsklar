# Break-glass (nödåtkomst)

Break-glass används endast i nödsituationer, t.ex. när ordinarie behöriga är
otillgängliga under en pågående allvarlig incident.

## Krav

- **Skäl krävs** (minst 10 tecken, loggas).
- **Tidsbegränsad**: standard 60 minuter, max 8 timmar.
- **Loggas fullständigt**: start, användning och avslut i revisionsloggen.
- **Notifierar** tenantens administratörer och CISO omedelbart (critical).
- **Synlig** i åtkomstgranskningen (`/app/access-review`) och i plattformens
  säkerhetsvy (`/platform/security`).
- **Ingår** i den exporterbara åtkomstgranskningsrapporten.

## Vem kan aktivera

- Tenant: `tenant_admin` eller `ciso`.
- Plattform: `platform_owner` eller `security_admin` (för plattformsnödlägen).

## Missbruksskydd

Anomaliregeln `break_glass_misuse` skapar granskningsärenden vid upprepade
sessioner eller sessioner som inte avslutas.
