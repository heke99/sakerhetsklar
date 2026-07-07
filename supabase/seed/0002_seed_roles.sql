-- Seed platform + tenant role catalog and permissions. No real PII.

insert into public.roles (code, scope, name_sv, name_en, description)
values
  -- Platform roles (spec §7)
  ('platform_owner', 'platform', 'Plattformsägare', 'Platform Owner', 'Full access to platform settings, billing, tenants, rules, feature flags and system health.'),
  ('platform_admin', 'platform', 'Plattformsadministratör', 'Platform Admin', 'Manage tenants, support, templates, integrations, billing and non-sensitive tenant overview.'),
  ('rule_admin', 'platform', 'Regeladministratör', 'Rule Admin', 'Create, update, version and publish legal rule packages, report field definitions and control mappings.'),
  ('support_admin', 'platform', 'Supportadministratör', 'Support Admin', 'Can request tenant support access; cannot access enterprise tenant data unless approved.'),
  ('billing_admin', 'platform', 'Faktureringsadministratör', 'Billing Admin', 'Manage plans, subscriptions, usage metrics and entitlements.'),
  ('security_admin', 'platform', 'Säkerhetsadministratör', 'Security Admin', 'Review audit logs, access logs, security settings and support access logs.'),
  ('readonly_auditor', 'platform', 'Granskare (läs)', 'Read-only Auditor', 'Platform audit visibility without write access.'),
  ('deployment_admin', 'platform', 'Driftadministratör', 'Deployment Admin', 'Manage environments, release status, migration status and production readiness gates.'),
  -- Tenant roles (spec §8)
  ('tenant_admin', 'tenant', 'Organisationsadministratör', 'Tenant Admin', 'Manage tenant settings, legal entities, users, roles, integrations and support access.'),
  ('ciso', 'tenant', 'CISO / Säkerhetsansvarig', 'CISO / Security Lead', 'Owns NIS2 readiness, controls, risk assessments, incident assessment and approvals.'),
  ('incident_manager', 'tenant', 'Incidentansvarig', 'Incident Manager', 'Creates and manages incidents, tasks, timelines, war rooms and reporting drafts.'),
  ('system_owner', 'tenant', 'Systemägare', 'System Owner', 'Owns systems/assets, service dependencies, patch status, RTO/RPO and evidence.'),
  ('information_owner', 'tenant', 'Informationsägare', 'Information Owner', 'Owns information assets and protected information classification.'),
  ('vendor_manager', 'tenant', 'Leverantörsansvarig', 'Vendor Manager', 'Manages suppliers, contracts, incident contacts, risk assessments and subcontractors.'),
  ('legal_compliance', 'tenant', 'Juridik / Compliance', 'Legal / Compliance', 'Approves regulatory decisions, reporting decisions and legal justifications.'),
  ('dpo', 'tenant', 'Dataskyddsombud', 'DPO', 'Owns GDPR personal data breach assessment and IMY reporting decisions.'),
  ('communications_lead', 'tenant', 'Kommunikationsansvarig', 'Communications Lead', 'Handles customer/recipient communication drafts and approvals.'),
  ('management_approver', 'tenant', 'Ledningsgodkännare', 'Management Approver', 'Approves serious incident reports, late reporting explanations and final reports.'),
  ('board_viewer', 'tenant', 'Styrelsevy', 'Board Viewer', 'Read-only management dashboard and board reports.'),
  ('external_soc', 'tenant', 'Extern SOC', 'External SOC', 'Limited incident/war-room access.'),
  ('external_consultant', 'tenant', 'Extern konsult', 'External Consultant', 'Limited scoped access.'),
  ('auditor', 'tenant', 'Revisor', 'Auditor', 'Read-only audit, evidence, controls and report exports.')
on conflict (code) do nothing;

insert into public.permissions (code, description)
values
  ('tenant.settings.read', 'Read tenant settings'),
  ('tenant.settings.write', 'Update tenant settings'),
  ('tenant.users.manage', 'Invite users and manage roles'),
  ('legal_entities.read', 'Read legal entities'),
  ('legal_entities.write', 'Manage legal entities'),
  ('scope.read', 'Read scope assessments'),
  ('scope.write', 'Run and update scope assessments'),
  ('systems.read', 'Read systems and digital environment'),
  ('systems.write', 'Manage systems and digital environment'),
  ('critical_services.read', 'Read critical services'),
  ('critical_services.write', 'Manage critical services'),
  ('vendors.read', 'Read vendors'),
  ('vendors.write', 'Manage vendors'),
  ('controls.read', 'Read controls'),
  ('controls.write', 'Manage controls'),
  ('controls.approve', 'Approve controls'),
  ('risks.read', 'Read risks'),
  ('risks.write', 'Manage risks'),
  ('incidents.read', 'Read incidents'),
  ('incidents.write', 'Create and manage incidents'),
  ('incidents.assess', 'Run significance assessments'),
  ('incidents.approve', 'Approve significance decisions'),
  ('reports.read', 'Read incident reports'),
  ('reports.write', 'Create and edit report drafts'),
  ('reports.approve', 'Approve reports'),
  ('reports.mark_submitted', 'Mark reports submitted and store Cyberportalen IDs'),
  ('gdpr.read', 'Read GDPR track'),
  ('gdpr.write', 'Manage GDPR track'),
  ('gdpr.approve', 'DPO approval of GDPR decisions'),
  ('evidence.read', 'Read evidence metadata'),
  ('evidence.write', 'Upload evidence'),
  ('evidence.download', 'Download evidence content'),
  ('evidence.restricted.read', 'Read restricted/security-sensitive evidence'),
  ('war_room.access', 'Access incident war rooms'),
  ('lathunds.run', 'Run lathund workflows'),
  ('exercises.run', 'Run tabletop exercises'),
  ('management.read', 'Read management dashboard'),
  ('exports.generate', 'Generate exports and packages'),
  ('audit.read', 'Read audit logs'),
  ('support_access.approve', 'Approve platform support access'),
  ('procurement.generate', 'Generate procurement packages')
on conflict (code) do nothing;

-- Role → permission mapping (baseline; refined by ABAC at runtime).
with rp (role_code, permission_code) as (
  values
    ('tenant_admin', 'tenant.settings.read'), ('tenant_admin', 'tenant.settings.write'),
    ('tenant_admin', 'tenant.users.manage'),
    ('tenant_admin', 'legal_entities.read'), ('tenant_admin', 'legal_entities.write'),
    ('tenant_admin', 'scope.read'), ('tenant_admin', 'scope.write'),
    ('tenant_admin', 'systems.read'), ('tenant_admin', 'systems.write'),
    ('tenant_admin', 'critical_services.read'), ('tenant_admin', 'critical_services.write'),
    ('tenant_admin', 'vendors.read'), ('tenant_admin', 'vendors.write'),
    ('tenant_admin', 'controls.read'), ('tenant_admin', 'controls.write'),
    ('tenant_admin', 'risks.read'), ('tenant_admin', 'risks.write'),
    ('tenant_admin', 'incidents.read'), ('tenant_admin', 'incidents.write'),
    ('tenant_admin', 'reports.read'),
    ('tenant_admin', 'gdpr.read'),
    ('tenant_admin', 'evidence.read'), ('tenant_admin', 'evidence.write'),
    ('tenant_admin', 'evidence.download'),
    ('tenant_admin', 'war_room.access'),
    ('tenant_admin', 'lathunds.run'), ('tenant_admin', 'exercises.run'),
    ('tenant_admin', 'management.read'),
    ('tenant_admin', 'exports.generate'),
    ('tenant_admin', 'audit.read'),
    ('tenant_admin', 'support_access.approve'),
    ('tenant_admin', 'procurement.generate'),

    ('ciso', 'scope.read'), ('ciso', 'scope.write'),
    ('ciso', 'legal_entities.read'),
    ('ciso', 'systems.read'), ('ciso', 'systems.write'),
    ('ciso', 'critical_services.read'), ('ciso', 'critical_services.write'),
    ('ciso', 'vendors.read'), ('ciso', 'vendors.write'),
    ('ciso', 'controls.read'), ('ciso', 'controls.write'), ('ciso', 'controls.approve'),
    ('ciso', 'risks.read'), ('ciso', 'risks.write'),
    ('ciso', 'incidents.read'), ('ciso', 'incidents.write'),
    ('ciso', 'incidents.assess'), ('ciso', 'incidents.approve'),
    ('ciso', 'reports.read'), ('ciso', 'reports.write'),
    ('ciso', 'gdpr.read'),
    ('ciso', 'evidence.read'), ('ciso', 'evidence.write'), ('ciso', 'evidence.download'),
    ('ciso', 'evidence.restricted.read'),
    ('ciso', 'war_room.access'),
    ('ciso', 'lathunds.run'), ('ciso', 'exercises.run'),
    ('ciso', 'management.read'),
    ('ciso', 'exports.generate'),
    ('ciso', 'audit.read'),

    ('incident_manager', 'incidents.read'), ('incident_manager', 'incidents.write'),
    ('incident_manager', 'incidents.assess'),
    ('incident_manager', 'reports.read'), ('incident_manager', 'reports.write'),
    ('incident_manager', 'systems.read'),
    ('incident_manager', 'critical_services.read'),
    ('incident_manager', 'vendors.read'),
    ('incident_manager', 'evidence.read'), ('incident_manager', 'evidence.write'),
    ('incident_manager', 'evidence.download'),
    ('incident_manager', 'war_room.access'),
    ('incident_manager', 'lathunds.run'),

    ('system_owner', 'systems.read'), ('system_owner', 'systems.write'),
    ('system_owner', 'critical_services.read'),
    ('system_owner', 'evidence.read'), ('system_owner', 'evidence.write'),
    ('system_owner', 'incidents.read'),

    ('information_owner', 'systems.read'),
    ('information_owner', 'evidence.read'),
    ('information_owner', 'incidents.read'),

    ('vendor_manager', 'vendors.read'), ('vendor_manager', 'vendors.write'),
    ('vendor_manager', 'systems.read'),
    ('vendor_manager', 'incidents.read'),

    ('legal_compliance', 'scope.read'),
    ('legal_compliance', 'incidents.read'), ('legal_compliance', 'incidents.approve'),
    ('legal_compliance', 'reports.read'), ('legal_compliance', 'reports.approve'),
    ('legal_compliance', 'reports.mark_submitted'),
    ('legal_compliance', 'gdpr.read'),
    ('legal_compliance', 'evidence.read'),
    ('legal_compliance', 'war_room.access'),
    ('legal_compliance', 'audit.read'),

    ('dpo', 'gdpr.read'), ('dpo', 'gdpr.write'), ('dpo', 'gdpr.approve'),
    ('dpo', 'incidents.read'),
    ('dpo', 'evidence.read'),
    ('dpo', 'audit.read'),

    ('communications_lead', 'incidents.read'),
    ('communications_lead', 'reports.read'),
    ('communications_lead', 'war_room.access'),

    ('management_approver', 'incidents.read'), ('management_approver', 'incidents.approve'),
    ('management_approver', 'reports.read'), ('management_approver', 'reports.approve'),
    ('management_approver', 'management.read'),

    ('board_viewer', 'management.read'),

    ('external_soc', 'incidents.read'), ('external_soc', 'incidents.write'),
    ('external_soc', 'war_room.access'),
    ('external_soc', 'evidence.read'), ('external_soc', 'evidence.write'),

    ('external_consultant', 'controls.read'),
    ('external_consultant', 'risks.read'),
    ('external_consultant', 'systems.read'),

    ('auditor', 'controls.read'),
    ('auditor', 'risks.read'),
    ('auditor', 'incidents.read'),
    ('auditor', 'reports.read'),
    ('auditor', 'evidence.read'),
    ('auditor', 'audit.read'),
    ('auditor', 'exports.generate')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from rp
join public.roles r on r.code = rp.role_code
join public.permissions p on p.code = rp.permission_code
on conflict do nothing;
