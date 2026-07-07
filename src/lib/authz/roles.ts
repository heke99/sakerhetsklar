/** Role and permission catalog shared by server and UI (labels only in UI). */

export const PLATFORM_ROLES = [
  "platform_owner",
  "platform_admin",
  "rule_admin",
  "support_admin",
  "billing_admin",
  "security_admin",
  "readonly_auditor",
  "deployment_admin",
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const TENANT_ROLES = [
  "tenant_admin",
  "ciso",
  "incident_manager",
  "system_owner",
  "information_owner",
  "vendor_manager",
  "legal_compliance",
  "dpo",
  "communications_lead",
  "management_approver",
  "board_viewer",
  "external_soc",
  "external_consultant",
  "auditor",
] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export type Permission =
  | "tenant.settings.read"
  | "tenant.settings.write"
  | "tenant.users.manage"
  | "legal_entities.read"
  | "legal_entities.write"
  | "scope.read"
  | "scope.write"
  | "systems.read"
  | "systems.write"
  | "critical_services.read"
  | "critical_services.write"
  | "vendors.read"
  | "vendors.write"
  | "controls.read"
  | "controls.write"
  | "controls.approve"
  | "risks.read"
  | "risks.write"
  | "incidents.read"
  | "incidents.write"
  | "incidents.assess"
  | "incidents.approve"
  | "reports.read"
  | "reports.write"
  | "reports.approve"
  | "reports.mark_submitted"
  | "gdpr.read"
  | "gdpr.write"
  | "gdpr.approve"
  | "evidence.read"
  | "evidence.write"
  | "evidence.download"
  | "evidence.restricted.read"
  | "war_room.access"
  | "lathunds.run"
  | "exercises.run"
  | "management.read"
  | "exports.generate"
  | "audit.read"
  | "support_access.approve"
  | "procurement.generate";

export const TENANT_ROLE_LABELS_SV: Record<TenantRole, string> = {
  tenant_admin: "Organisationsadministratör",
  ciso: "CISO / Säkerhetsansvarig",
  incident_manager: "Incidentansvarig",
  system_owner: "Systemägare",
  information_owner: "Informationsägare",
  vendor_manager: "Leverantörsansvarig",
  legal_compliance: "Juridik / Compliance",
  dpo: "Dataskyddsombud",
  communications_lead: "Kommunikationsansvarig",
  management_approver: "Ledningsgodkännare",
  board_viewer: "Styrelsevy",
  external_soc: "Extern SOC",
  external_consultant: "Extern konsult",
  auditor: "Revisor",
};

export const PLATFORM_ROLE_LABELS_SV: Record<PlatformRole, string> = {
  platform_owner: "Plattformsägare",
  platform_admin: "Plattformsadministratör",
  rule_admin: "Regeladministratör",
  support_admin: "Supportadministratör",
  billing_admin: "Faktureringsadministratör",
  security_admin: "Säkerhetsadministratör",
  readonly_auditor: "Granskare (läs)",
  deployment_admin: "Driftadministratör",
};
