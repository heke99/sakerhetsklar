# Data model

Migrations live in `supabase/migrations/` and apply in order. All tenant tables
carry `tenant_id`, timestamps and (where relevant) `created_by`/`updated_by`
and soft-delete `deleted_at`. RLS is enabled on every table (see
`rls-security.md`).

## Domain groups → migrations

| Domain | Migration | Key tables |
| --- | --- | --- |
| Foundation | 0001–0002 | tenants, legal_entities, sectors, regulatory_rule_sets, audit_logs, profiles, roles, permissions, role_assignments, tenant_memberships, tenant_settings, tenant_invitations, notifications, platform_admin_users |
| Control plane | 0003 | control_plane_tenants, tenant_domains, tenant_environments, tenant_modules, tenant_auth_providers, tenant_release/migration/backup/health/readiness, tenant_feature_flags, tenant_rule_package_versions, tenant_data_plane_connections, tenant_deployment_models, control_plane_* views |
| Support access | 0004 | support_access_requests, support_access_logs |
| Rule engine | 0005 | legal_sources(+documents), regulatory_rules, regulatory_rule_versions, regulatory_change_logs, rule_effectivity_periods, rule_coverage_statuses, regulatory_tracks, report_field_definitions |
| Scope/onboarding | 0006 | subsectors, activity/entity types, supervisory_authorities(+mappings), company_groups, ownership_relations, scope_assessments/answers/results, entity_size_assessments, jurisdiction_assessments, essential_important_classifications, registration_records(+receipts/change logs), onboarding_steps/progress/blockers |
| CMDB | 0007 | digital_environments, systems, segments (IT/OT), critical_services(+links), sector_critical_systems, information_assets, protected_information_assets, information_flows, system_dependencies |
| Vendors | 0008 | vendors, vendor_contacts/services/contracts, subcontractors, vendor_risk_assessments, outsourced_processing_records |
| Controls/risks | 0009 | control_requirements, controls, control_assignments, control_evidence, risk_assessments, risks, risk_treatments, risk_acceptances, action_plans, management_members(+training), data_quality_rules/findings, required_field_completeness |
| Incidents | 0010 | incidents, incident_events/statuses, system/service/vendor impacts, impact assessments, protected info impacts, decision logs, tasks, comments |
| Significance | 0011 | incident_significance_assessments, incident_regulatory_tracks |
| Reporting | 0012 | incident_reports(+fields/submissions), cyberportal_incident_ids, report_receipts, reserve_procedure_records, incident_deadlines, late_reporting_records, report_templates(+versions), language_variants |
| Parallel tracks | 0013 | incident_personal_data_assessments, gdpr_reports, imy_submission_records, eidas_reports, pts_submission_records, recipients(+groups/notifications), message_templates, insurance_policies(+notifications), customer_contract_reporting_requirements, contractual_notification_deadlines |
| Evidence/war room | 0014 | evidence(+versions/hashes/access logs/chain of custody), legal_holds(+items), retention_policies, access/export/download logs, incident_war_rooms(+members/decisions/tasks/messages) |
| Lathunds/exercises | 0015 | lathunds(+steps/runs/run steps), exercise_scenarios/runs/findings/action plans, continuity + DR plans, backup/restore tests, manual_workarounds |
| Exports/billing | 0016 | exports, audit_packages, billing_plans, entitlements, subscriptions, usage_metrics, billing_events |
| Security | 0017 | abac_policies, approval_chains, break_glass_sessions, access_reviews(+items), security_anomaly_rules/events, privacy_anomaly_events, anomaly_review_cases |
| Integrations | 0018 | integrations(+error logs), webhooks(+deliveries), api_keys, scim_tokens, scim_provisioning_logs |

## Conventions

- Enumerations are CHECK constraints (values documented in the migration).
- Secrets are never stored: only references (`*_ref` columns) to server-side
  environment/secret-manager entries.
- JSONB is used for rule conditions/params/outputs, assessment facts, report
  snapshots and manifest payloads.
