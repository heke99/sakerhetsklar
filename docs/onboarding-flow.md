# Onboarding flow

Ten guided steps (`/app/onboarding`, progress in `onboarding_progress`):

1. **Skapa organisation** — organization data, type, primary contact.
2. **Juridiska enheter och koncernstruktur** — entities, group, ownership,
   whether group figures affect the size assessment.
3. **Storleksbedömning** — employees, turnover, balance sheet (EUR), group
   figures. The SME engine (`src/lib/size-engine`) outputs
   micro/small/medium/large with an explanation.
4. **Sektor- och verksamhetsbedömning** — the 18 NIS2 sectors, subsectors,
   special categories (DNS/TLD/telecom/trust services/CER/supplier/security
   protection).
5. **Regelprofil** — the scope engine evaluates DB rules and outputs: likely
   covered (yes/no/manual review), classification (essential/important/public/
   manual review), supervisory authorities, active + pending rule packages,
   manual-review reasons, next steps. Everything traceable via "Visa
   regelkälla".
6. **Registreringsstöd** — MCFFS 2026:1 checklist (active from 2 Feb 2026),
   receipt upload, 14-day change notification tracking.
7. **Kritiska system och tjänster** — manual entry or Excel import.
8. **Leverantörer** — vendor register with incident contacts.
9. **Incidentroller** — Incident Manager, CISO, Legal, DPO, Communications,
   Management Approver.
10. **Klart** — readiness percentages and recommended next tasks on the
    overview.

Completion is tracked per step; the tenant-level onboarding status
(not_started/in_progress/blocked/complete) is recomputed on every step update
and surfaces in the superadmin tenant list.
