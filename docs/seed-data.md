# Seed data

Seeds live in `supabase/seed/` and apply in order after migrations. **No real
PII** — all names, contacts and organization numbers are fictional
(`*.example.test` mailboxes, function inboxes).

| File | Content |
| --- | --- |
| 0001_seed_core.sql | 16 rule packages, 18 sectors |
| 0002_seed_roles.sql | platform + tenant roles, permission catalog, role→permission map |
| 0003_seed_platform.sql | feature flags |
| 0004_seed_rule_engine.sql | legal sources (CSL, CSF, MCFFS 2026:1/7/8/11/12, EU 2024/2690, GDPR, eIDAS), effectivity dates (15 Jan/2 Feb/1 Jul/1 Oct 2026), PTS draft/partial coverage, regulatory tracks |
| 0005_seed_sectors_authorities.sql | supervisory authorities, sector→authority mapping, subsectors, entity types, onboarding steps |
| 0006_seed_classification_rules.sql | CSL coverage/classification rules + CER/DORA/security-protection flags |
| 0007_seed_controls.sql | 25-area control library (MCFFS 2026:11/12 marked pending until 1 Oct 2026), data-quality rules |
| 0008_seed_mcffs_2026_8_rules.sql | MCFFS 2026:8 general + sector thresholds, deadline rules, MCFFS 2026:7 state-agency rules |
| 0009_seed_eu_2024_2690_rules.sql | EU 2024/2690 art. 3/4/7/10 thresholds, art. 5/6/8/9/11–14 structural manual-review rules, parallel-track triggers, eIDAS 24h deadline |
| 0010_seed_report_fields.sql | report field definitions for all stages + template registry |
| 0011_seed_lathunds.sql | 24 lathunds with steps, 9 exercise scenarios |
| 0012_seed_demo.sql | 5 demo tenants (municipal VA, energy, MSP/cloud, state agency, SMB) and 6 demo incidents: drinking water outage (reportable + 24h draft), ransomware (war room), cloud outage (manual review, EU 2024/2690), state-agency DDoS (6h track), personal data breach (IMY required), late-reporting case (missed 24h + explanation) |

Sector thresholds that lack an official final source are seeded as
`requires_manual_review` rules — thresholds are never invented.
