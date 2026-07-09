/**
 * OpenAPI 3.1 description of the Säkerhetsklar backend API (spec §41).
 * Static, hand-maintained document — contract tests in
 * src/lib/api/openapi.test.ts assert that every route file is documented and
 * that documented methods match the implementation, so drift fails CI.
 */
export const openApiDoc = {
  openapi: "3.1.0",
  info: {
    title: "Säkerhetsklar API",
    version: "1.0.0",
    description:
      "Backend API for the Säkerhetsklar NIS2/Cybersäkerhetslagen compliance platform. " +
      "All endpoints require an authenticated Supabase session cookie unless noted. " +
      "Tenant scoping: list endpoints take a `tenantId` query parameter and require tenant membership; " +
      "resource endpoints resolve tenant ownership server-side — cross-tenant ids return 404 without revealing existence. " +
      "Errors are always `{ error: { code, message } }` (422 adds `issues`). " +
      "Pagination: list endpoints return the most recent rows (typically capped at 100–200); use filters to narrow. " +
      "Rate limits: public invitation endpoints are rate limited per IP (429). " +
      "File upload uses multipart/form-data (`/evidence`, `/systems/import`); downloads return files or short-lived signed URLs. " +
      "Job endpoints (`/jobs/*`) are for schedulers only and require the job secret (`x-job-secret` header or `Authorization: Bearer`). " +
      "Outbound webhooks are HMAC-SHA256-signed (`X-Sakerhetsklar-Signature` over `timestamp.body`, header `X-Sakerhetsklar-Timestamp`) with up to 5 delivery attempts. " +
      "Säkerhetsklar provides decision support — final legal responsibility remains with the organization.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "sb-access-token" },
      jobSecret: { type: "apiKey", in: "header", name: "x-job-secret" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" } },
          },
        },
      },
    },
  },
  security: [{ sessionCookie: [] }],
  paths: {
    "/health": { get: { summary: "Public liveness probe", security: [], responses: { "200": { description: "OK" } } } },
    "/health/readiness": {
      get: {
        summary: "Operational readiness (platform admin or job secret): DB, storage, migrations, config, rule freshness, data planes",
        security: [{ sessionCookie: [] }, { jobSecret: [] }],
        responses: { "200": { description: "Ready/degraded" }, "503": { description: "Failed checks" } },
      },
    },
    "/control-plane/resolve": {
      get: {
        summary: "Resolve current host to safe tenant config (fail closed)",
        security: [],
        responses: { "200": { description: "Safe config" }, "404": { description: "Unknown domain" } },
      },
    },
    "/auth/me": { get: { summary: "Current actor with roles", responses: { "200": { description: "Actor" } } } },
    "/tenants": {
      get: { summary: "List tenants (platform or own)", responses: { "200": { description: "Tenants" } } },
      post: { summary: "Create tenant (platform admin)", responses: { "201": { description: "Created" } } },
    },
    "/tenants/{id}": {
      get: { summary: "Tenant detail", responses: { "200": { description: "Tenant" } } },
      patch: { summary: "Update tenant (plan/status/deployment via platform)", responses: { "200": { description: "Updated" } } },
    },
    "/tenants/{id}/invitations": {
      get: { summary: "List invitations", responses: { "200": { description: "Invitations" } } },
      post: { summary: "Invite user with role (e-mail delivery; token never returned in production)", responses: { "201": { description: "Invitation" } } },
      patch: { summary: "Revoke or resend an invitation", responses: { "200": { description: "Invitation" } } },
    },
    "/tenants/{id}/members": {
      get: { summary: "List members with roles", responses: { "200": { description: "Members" } } },
      post: { summary: "Assign tenant role", responses: { "201": { description: "Assignment" } } },
      patch: { summary: "Change member role or deactivate member", responses: { "200": { description: "Member" } } },
    },
    "/invitations/lookup": {
      post: { summary: "Resolve invite token to safe info (public, rate limited)", security: [], responses: { "200": { description: "Invitation info" }, "404": { description: "Invalid or expired" }, "429": { description: "Rate limited" } } },
    },
    "/invitations/accept": {
      post: { summary: "Accept invitation (public, rate limited; creates account or attaches membership)", security: [], responses: { "200": { description: "Accepted or requires_login" }, "404": { description: "Invalid or expired" }, "429": { description: "Rate limited" } } },
    },
    "/legal-entities": {
      get: { summary: "List legal entities", responses: { "200": { description: "Legal entities" } } },
      post: { summary: "Create legal entity", responses: { "201": { description: "Legal entity" } } },
    },
    "/notifications": {
      get: { summary: "Current user's in-app notifications", responses: { "200": { description: "Notifications" } } },
      patch: { summary: "Mark notifications as read", responses: { "200": { description: "Updated" } } },
    },
    "/tenants/{id}/domains": {
      get: { summary: "List tenant domains", responses: { "200": { description: "Domains" } } },
      post: { summary: "Register domain (platform)", responses: { "201": { description: "Domain" } } },
    },
    "/rules": { get: { summary: "List rule packages with status/coverage", responses: { "200": { description: "Rule sets" } } } },
    "/rules/{code}": { get: { summary: "Rule set with rules, coverage and versions", responses: { "200": { description: "Detail" } } } },
    "/rules/{code}/rules": { post: { summary: "Create rule (rule admin)", responses: { "201": { description: "Rule" } } } },
    "/rules/{code}/publish": {
      get: { summary: "Preview impacted tenants", responses: { "200": { description: "Impacted tenants" } } },
      post: { summary: "Publish rule set version (rule admin)", responses: { "201": { description: "Version + impacted tenants" } } },
    },
    "/sectors": { get: { summary: "Sectors and subsectors", responses: { "200": { description: "Reference data" } } } },
    "/authorities": { get: { summary: "Supervisory authorities and mappings", responses: { "200": { description: "Reference data" } } } },
    "/onboarding": {
      get: { summary: "Onboarding steps and progress", responses: { "200": { description: "Progress" } } },
      post: { summary: "Update onboarding step", responses: { "200": { description: "Updated" } } },
      put: { summary: "Save onboarding contacts and requirements", responses: { "200": { description: "Settings" } } },
    },
    "/openapi.json": {
      get: { summary: "This OpenAPI document", security: [], responses: { "200": { description: "OpenAPI 3.1 document" } } },
    },
    "/scope": {
      get: { summary: "Latest scope result", responses: { "200": { description: "Scope result" } } },
      post: { summary: "Run scope assessment (rule engine)", responses: { "201": { description: "Result with classification, authorities, packages" } } },
    },
    "/scope/size": { post: { summary: "Run SME size assessment", responses: { "201": { description: "Size class" } } } },
    "/systems": {
      get: { summary: "List systems", responses: { "200": { description: "Systems" } } },
      post: { summary: "Create system", responses: { "201": { description: "System" } } },
    },
    "/systems/import": { post: { summary: "Excel import of systems (multipart)", responses: { "201": { description: "Import result" } } } },
    "/critical-services": {
      get: { summary: "List critical services", responses: { "200": { description: "Services" } } },
      post: { summary: "Create critical service", responses: { "201": { description: "Service" } } },
    },
    "/vendors": {
      get: { summary: "List vendors", responses: { "200": { description: "Vendors" } } },
      post: { summary: "Create vendor", responses: { "201": { description: "Vendor" } } },
    },
    "/controls": {
      get: { summary: "List controls + readiness scores", responses: { "200": { description: "Controls" } } },
      patch: { summary: "Update control status/assignment", responses: { "200": { description: "Control" } } },
    },
    "/risks": {
      get: { summary: "List risks", responses: { "200": { description: "Risks" } } },
      post: { summary: "Create risk", responses: { "201": { description: "Risk" } } },
    },
    "/incidents": {
      get: { summary: "List incidents", responses: { "200": { description: "Incidents" } } },
      post: { summary: "Create incident with impacts", responses: { "201": { description: "Incident" } } },
    },
    "/incidents/{id}": {
      get: { summary: "Incident detail with timeline", responses: { "200": { description: "Incident" } } },
      patch: { summary: "Change status/severity", responses: { "200": { description: "Updated" } } },
    },
    "/incidents/{id}/significance": {
      get: { summary: "Assessment history", responses: { "200": { description: "Assessments" } } },
      post: { summary: "Run significance engine", responses: { "201": { description: "Recommendation with matched rules, confidence, deadlines" } } },
      patch: { summary: "Approve/reject assessment", responses: { "200": { description: "Decision" } } },
    },
    "/incidents/{id}/reports": {
      get: { summary: "Reports for incident", responses: { "200": { description: "Reports" } } },
      post: { summary: "Create report draft for stage", responses: { "201": { description: "Report" } } },
    },
    "/incidents/{id}/tasks": { post: { summary: "Create incident task", responses: { "201": { description: "Task" } } }, patch: { summary: "Update task status", responses: { "200": { description: "Task" } } } },
    "/incidents/{id}/comments": { post: { summary: "Add comment", responses: { "201": { description: "Comment" } } } },
    "/incidents/{id}/war-room": {
      get: { summary: "War room detail", responses: { "200": { description: "War room" } } },
      post: { summary: "Activate/close/add member/decision/task/message", responses: { "201": { description: "Result" } } },
    },
    "/incidents/{id}/late-reporting": {
      get: { summary: "Late reporting records", responses: { "200": { description: "Records" } } },
      patch: { summary: "Update explanation, generate drafts, approve", responses: { "200": { description: "Record" } } },
    },
    "/incidents/{id}/recipients": {
      get: { summary: "Recipient notification decisions", responses: { "200": { description: "Decisions" } } },
      post: { summary: "Record notification decision (reason + approver)", responses: { "201": { description: "Decision" } } },
    },
    "/reports/{id}": {
      get: { summary: "Report with fields + definitions", responses: { "200": { description: "Report" } } },
      patch: { summary: "Update fields / status flow / Cyberportalen ID", responses: { "200": { description: "Updated" } } },
    },
    "/reports/{id}/export": { get: { summary: "Export report as PDF/Word", responses: { "200": { description: "File" } } } },
    "/gdpr": {
      get: { summary: "GDPR assessments", responses: { "200": { description: "Assessments" } } },
      post: { summary: "Update GDPR track (DPO approval, IMY submission)", responses: { "200": { description: "Assessment" } } },
    },
    "/eidas": {
      get: { summary: "eIDAS reports", responses: { "200": { description: "Reports" } } },
      post: { summary: "Update/submit eIDAS report", responses: { "200": { description: "Report" } } },
    },
    "/insurance": {
      get: { summary: "Insurance policies", responses: { "200": { description: "Policies" } } },
      post: { summary: "Create policy", responses: { "201": { description: "Policy" } } },
      patch: { summary: "Record insurance notification for incident", responses: { "201": { description: "Notification" } } },
    },
    "/contracts": {
      get: { summary: "Contractual reporting requirements", responses: { "200": { description: "Requirements" } } },
      post: { summary: "Create requirement", responses: { "201": { description: "Requirement" } } },
      patch: { summary: "Record contractual notification for incident", responses: { "201": { description: "Notification" } } },
    },
    "/evidence": {
      get: { summary: "Evidence metadata (classification-scoped)", responses: { "200": { description: "Evidence" } } },
      post: { summary: "Upload evidence (multipart, hashed, custody-logged)", responses: { "201": { description: "Evidence" } } },
    },
    "/evidence/{id}/download": { post: { summary: "Signed download URL (logged; restricted requires reason)", responses: { "200": { description: "URL" } } } },
    "/lathunds": {
      get: { summary: "Lathund library with steps", responses: { "200": { description: "Lathunds" } } },
      post: { summary: "Start lathund run", responses: { "201": { description: "Run" } } },
      patch: { summary: "Complete/uncomplete step", responses: { "200": { description: "Step" } } },
    },
    "/exercises": {
      get: { summary: "Scenarios and runs", responses: { "200": { description: "Exercises" } } },
      post: { summary: "Start exercise run", responses: { "201": { description: "Run" } } },
      patch: { summary: "Complete run with findings/actions", responses: { "200": { description: "Run" } } },
    },
    "/exports": { get: { summary: "Generate exports (board report, supervisory package, Excel registers)", responses: { "200": { description: "File" } } } },
    "/procurement": { get: { summary: "Generate procurement/security package (ZIP)", responses: { "200": { description: "File" } } } },
    "/support-access": {
      get: { summary: "List support access requests", responses: { "200": { description: "Requests" } } },
      post: { summary: "Request support access (platform support role)", responses: { "201": { description: "Request" } } },
    },
    "/support-access/{id}": { post: { summary: "Approve/deny/revoke (tenant decides)", responses: { "200": { description: "Decision" } } } },
    "/security/break-glass": {
      post: { summary: "Start break-glass session (reason required)", responses: { "201": { description: "Session" } } },
      patch: { summary: "End break-glass session", responses: { "200": { description: "Session" } } },
    },
    "/anomalies": { get: { summary: "Anomaly events and review cases", responses: { "200": { description: "Anomalies" } } } },
    "/audit": { get: { summary: "Audit logs (permission-scoped)", responses: { "200": { description: "Logs" } } } },
    "/integrations": {
      get: { summary: "Tenant integrations", responses: { "200": { description: "Integrations" } } },
      post: { summary: "Configure integration (secrets by reference)", responses: { "201": { description: "Integration" } } },
    },
    "/webhooks": {
      get: { summary: "Tenant webhooks", responses: { "200": { description: "Webhooks" } } },
      post: { summary: "Register signed webhook", responses: { "201": { description: "Webhook" } } },
      patch: { summary: "Send test event", responses: { "200": { description: "Enqueued" } } },
    },
    "/jobs/escalations": { post: { summary: "Deadline escalation job", security: [{ jobSecret: [] }], responses: { "200": { description: "Result" } } } },
    "/jobs/anomaly-scan": { post: { summary: "Anomaly scan job", security: [{ jobSecret: [] }], responses: { "200": { description: "Result" } } } },
    "/jobs/webhooks": { post: { summary: "Webhook delivery job", security: [{ jobSecret: [] }], responses: { "200": { description: "Result" } } } },
  },
} as const;
