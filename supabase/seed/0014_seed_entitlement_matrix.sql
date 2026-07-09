-- Seed 0014: complete plan/entitlement matrix (batch 15).
--
-- The entitlement service FAILS CLOSED for keys without a row, so every plan
-- must define every gated key explicitly. limit_value null = unlimited.

insert into public.entitlements (plan_code, entitlement_key, limit_value, enabled)
values
  -- Starter (Bas): core compliance for a single small organization.
  ('starter', 'evidence_bank', null, true),
  ('starter', 'gdpr_track', null, true),
  ('starter', 'exports', null, true),
  ('starter', 'advanced_reporting', null, false),
  ('starter', 'procurement_package', null, false),
  ('starter', 'supplier_risk', null, true),
  ('starter', 'leadership', null, true),
  ('starter', 'webhooks', null, false),
  ('starter', 'api_access', null, true),
  ('starter', 'sso_saml', null, false),
  ('starter', 'scim', null, false),
  ('starter', 'break_glass', null, false),
  ('starter', 'ip_allowlist', null, false),
  ('starter', 'single_tenant', null, false),
  ('starter', 'customer_owned_data_plane', null, false),

  -- Business (Verksamhet): larger organizations, procurement + webhooks.
  ('business', 'integrations', 5, true),
  ('business', 'exports', null, true),
  ('business', 'advanced_reporting', null, true),
  ('business', 'procurement_package', null, true),
  ('business', 'supplier_risk', null, true),
  ('business', 'leadership', null, true),
  ('business', 'webhooks', null, true),
  ('business', 'api_access', null, true),
  ('business', 'sso_saml', null, false),
  ('business', 'scim', null, false),
  ('business', 'break_glass', null, false),
  ('business', 'ip_allowlist', null, false),
  ('business', 'single_tenant', null, false),
  ('business', 'customer_owned_data_plane', null, false),

  -- Enterprise: everything, unlimited.
  ('enterprise', 'evidence_bank', null, true),
  ('enterprise', 'gdpr_track', null, true),
  ('enterprise', 'integrations', null, true),
  ('enterprise', 'exports', null, true),
  ('enterprise', 'advanced_reporting', null, true),
  ('enterprise', 'procurement_package', null, true),
  ('enterprise', 'supplier_risk', null, true),
  ('enterprise', 'leadership', null, true),
  ('enterprise', 'webhooks', null, true),
  ('enterprise', 'api_access', null, true)
on conflict (plan_code, entitlement_key) do nothing;
