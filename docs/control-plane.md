# Control plane

The control plane is the platform's operational registry. It exists so that
superadmin can operate hundreds of tenants without ever touching sensitive
tenant content.

## May contain

Tenant registry (name, org number, slug), deployment model + history, domains,
environments, enabled modules, plan/license, product version, rule package
versions, migration status, health status, feature flags, integration status
(without secrets/payloads), support case metadata, production readiness gates,
backup status (without content) and incident **counts** (no details).

## Must never contain

Full incident descriptions, evidence content, forensic files, protected or
security-classified information, personal data breach content, Cyberportalen
report bodies, vendor confidential evidence, customer secrets or service role
keys.

Enforced by design: the control-plane tables simply have no columns for such
content, `tenant_data_plane_connections` stores secret **references** only,
and incident metrics are aggregated counters (`open_incident_count`,
`potential_significant_incident_count`, `missed_deadline_count`).

## Tables

`control_plane_tenants` (1:1 registry), `tenant_domains`,
`tenant_environments`, `tenant_modules`, `tenant_auth_providers`,
`tenant_release_status`, `tenant_migration_status`,
`tenant_production_readiness`, `tenant_health_checks`, `tenant_backup_status`,
`tenant_feature_flags`, `tenant_rule_package_versions`,
`tenant_support_cases`, `tenant_data_plane_connections`, plus read-only
`control_plane_*` alias views.

## Consumers

- Superadmin UI (`/platform/**`) — dashboards, tenant list/profile, health,
  deployments, release status.
- Tenant resolver — domain → safe config.
- Release tooling — migration/release status per tenant.
