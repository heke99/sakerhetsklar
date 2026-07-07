-- Platform seed: feature flags. No real PII.

insert into public.feature_flags (flag_code, description, default_enabled)
values
  ('war_room', 'Incident war room for serious incidents', true),
  ('ai_assistance', 'AI drafting assistance with guardrails', false),
  ('teams_notifications', 'Microsoft Teams notifications', false),
  ('excel_import', 'Excel import for systems and vendors', true),
  ('procurement_package', 'Procurement/security package generation', true),
  ('break_glass', 'Break-glass emergency access', true),
  ('anomaly_detection', 'Security/privacy anomaly detection', true)
on conflict (flag_code) do nothing;
