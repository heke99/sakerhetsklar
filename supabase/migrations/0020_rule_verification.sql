-- 0020_rule_verification.sql
--
-- Legal source verification metadata (production-readiness batch 7):
-- every rule set/rule carries when it was last verified against the official
-- source, by whom, and a free-text source note. This makes regulatory
-- freshness auditable in the database instead of only in commit history.

alter table public.regulatory_rule_sets
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by text,
  add column if not exists source_note text;

alter table public.regulatory_rules
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by text,
  add column if not exists source_note text;

alter table public.legal_sources
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by text;
