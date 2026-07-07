# Cyberportalen copy mode

Säkerhetsklar does not integrate with the Cyberportalen API in MVP. Instead,
the copy mode makes manual submission fast and error-free.

## How it works

1. Open a report (`/app/reports/[id]`) and press **"Öppna kopiera-till-
   Cyberportalen"**.
2. Fields appear in the exact order they should be entered, using the
   `copy_label` defined in `report_field_definitions`.
3. Each field has a **Kopiera** button; **Kopiera allt** copies the entire
   report as labeled text.
4. Submit in Cyberportalen, then press **"Markera som inskickad"** (logged,
   marks the legal deadline as met).
5. Save the **stage-specific Cyberportalen incident ID** — a new ID may exist
   per reporting step and is stored in `cyberportal_incident_ids`.
6. Upload the receipt (stored in the receipts bucket, linked to the report).

## Guardrails

- A report stage cannot be closed without an ID or an explicit, audited
  override reason.
- Missing-ID reports appear as data-quality warnings and on dashboards.
- All submission markings, ID saves and receipt uploads are audit-logged.

## Reserve procedure

If Cyberportalen is unavailable: document the reason, classify the
information (security-classified content must not be uploaded unless the
deployment is approved), export the report (PDF/Word), choose an approved
submission method (secure link/registered mail/other), record the tracking
number and evidence. Deadlines still apply.
