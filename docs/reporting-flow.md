# Reporting flow

Report stages (per incident, per track):

| Stage | Deadline | Content |
| --- | --- | --- |
| Upplysning (early warning) | 24h from identified-as-significant | org data, ongoing?, timeline, detection, malicious?, supplier origin, sector impact, consequences, cross-border |
| Incidentanmälan | 72h | update of the early warning, occurrence/end times, cause, system impact, IoC, protected info impact, actions, remaining risks |
| Slutrapport | 1 month after incidentanmälan | final consequences, affected recipients, geography, economic damage, cross-border, societal functions, root cause, technical/organizational measures, recurrence prevention, management approval |
| Lägesrapport | at final-report deadline if ongoing | why ongoing, estimated duration, continued impact, IoC, next update plan |
| Statlig varning | 6h (MCFFS 2026:7 track) | agency, summary, assessed impact, contact |
| IMY-anmälan | normally 72h from awareness (GDPR track) | breach description, categories, subjects, consequences, measures, DPO contact |

Fields are defined in `report_field_definitions` (label, copy label, type,
required, validation, help text, source rule, legal reference, order). Drafts
prefill from incident/tenant data.

## Status flow

draft → ready_for_review → approved → submitted_in_cyberportalen →
cyberportal_incident_id_saved → receipt_uploaded (or `late`).

- Approval requires `reports.approve`; marking submitted requires
  `reports.mark_submitted`.
- Marking submitted records a submission and marks the corresponding legal
  deadline as met.
- **Cyberportalen IDs are stage-specific** and required: a stage cannot be
  closed without an ID or an explicit override reason (both audited).
- Receipts are uploaded per report.

## Copy mode and exports

The copy mode shows the exact ordered fields with per-field copy buttons and a
copy-all button; PDF and Word exports are available per report. The
Cyberportalen API is **not** assumed in MVP — reporting is copy/export based,
with a reserve procedure (secure link/registered mail/other approved method,
tracking number, deadline reminder) when Cyberportalen is unavailable.
