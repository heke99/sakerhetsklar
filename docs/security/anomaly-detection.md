# Anomalidetektering

Säkerhetsklar detekterar avvikande åtkomst- och exportmönster (spec §38).

## Regler (seedade, konfigurerbara)

| Regel | Kategori | Standard­tröskel |
| --- | --- | --- |
| unusual_evidence_views | security | 30 händelser / 24 h |
| repeated_restricted_access | security | 5 / 24 h |
| large_export_attempts | security | 10 / 24 h |
| mass_downloads | security | 20 / 24 h |
| after_hours_access | privacy | 5 nattliga åtkomster |
| repeated_role_changes | security | 5 / 24 h |
| break_glass_misuse | security | 2 / 72 h |
| suspicious_submission_changes | security | 5 / 24 h |
| unusual_deletions | security | 10 / 24 h |

Trösklar lagras i `security_anomaly_rules.params` och kan justeras utan
kodändring.

## Flöde

1. Jobbet `POST /api/v1/jobs/anomaly-scan` (schemalagt, hemlighetsskyddat) kör
   reglerna mot åtkomst-, export-, nedladdnings- och revisionsloggar.
2. Träffar skapar `security_anomaly_events` / `privacy_anomaly_events` samt
   `anomaly_review_cases` (öppna granskningsärenden).
3. Ärenden visas i kundens åtkomstgranskning, DPO-vyn (`/app/privacy`) och
   plattformens säkerhetsvy (`/platform/security`).

Detekteringen är idempotent per regel, aktör och tidsfönster.
