-- 0022_submission_reference.sql
--
-- Batch 9: submission records carry the stage-specific submission reference
-- (Cyberportalen id or reserve-procedure reference) directly, so every
-- recorded submission is self-describing for audits.

alter table public.incident_report_submissions
  add column if not exists reference text;
