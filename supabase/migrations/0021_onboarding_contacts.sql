-- 0021_onboarding_contacts.sql
--
-- Onboarding completeness (batch 8): structured contact/ownership facts and
-- customer requirements captured during onboarding. Stored on tenant_settings
-- (control plane; operational metadata, no incident content).

alter table public.tenant_settings
  add column if not exists incident_contact_name text,
  add column if not exists incident_contact_email text,
  add column if not exists reporting_contact_name text,
  add column if not exists reporting_contact_email text,
  add column if not exists management_owner_name text,
  add column if not exists dpo_contact_name text,
  add column if not exists dpo_contact_email text,
  add column if not exists sso_required_preference boolean,
  add column if not exists data_residency_requirement text,
  add column if not exists deployment_model_preference text
    check (deployment_model_preference is null or deployment_model_preference in (
      'multi_tenant', 'single_tenant', 'customer_owned'
    ));
