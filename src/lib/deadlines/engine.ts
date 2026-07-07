/**
 * Deadline and escalation engine (spec §19). Pure functions — persistence and
 * notification dispatch live in the service layer.
 */

export interface DeadlineDefinitionInput {
  deadlineType: string;
  hoursFromSignificant?: number;
  daysFromNotification?: number;
  legalReference?: string | null;
  titleSv?: string;
}

export interface ComputedDeadline {
  deadlineType: string;
  dueAt: Date;
  legalReference: string | null;
}

/**
 * Computes concrete due dates:
 * - hour-based deadlines run from identified_as_significant_at,
 * - day-based deadlines (final report) run from the incident notification
 *   submission (or its due date if not yet submitted).
 */
export function computeDeadlines(
  definitions: DeadlineDefinitionInput[],
  anchors: {
    identifiedAsSignificantAt: Date;
    notificationSubmittedAt?: Date | null;
  },
): ComputedDeadline[] {
  const results: ComputedDeadline[] = [];

  const notificationDef = definitions.find(
    (d) => d.deadlineType === "incident_notification" && d.hoursFromSignificant,
  );
  const notificationDue = notificationDef
    ? addHours(anchors.identifiedAsSignificantAt, notificationDef.hoursFromSignificant!)
    : null;

  for (const def of definitions) {
    if (def.hoursFromSignificant !== undefined) {
      results.push({
        deadlineType: def.deadlineType,
        dueAt: addHours(anchors.identifiedAsSignificantAt, def.hoursFromSignificant),
        legalReference: def.legalReference ?? null,
      });
    } else if (def.daysFromNotification !== undefined) {
      const anchor =
        anchors.notificationSubmittedAt ?? notificationDue ?? anchors.identifiedAsSignificantAt;
      results.push({
        deadlineType: def.deadlineType,
        dueAt: addDays(anchor, def.daysFromNotification),
        legalReference: def.legalReference ?? null,
      });
    }
  }
  return results;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 3600_000);
}

/** Escalation ladder (spec §19). */
export const ESCALATION_STEPS = [
  { key: "t_minus_24h", offsetHours: -24, severity: "info", targets: ["incident_manager"], messageSv: "Påminnelse: potentiell rapporteringsdeadline om 24 timmar." },
  { key: "t_minus_12h", offsetHours: -12, severity: "warning", targets: ["incident_manager"], messageSv: "Påminnelse till incidentansvarig: deadline om 12 timmar." },
  { key: "t_minus_6h", offsetHours: -6, severity: "warning", targets: ["ciso", "legal_compliance"], messageSv: "Påminnelse till CISO och juridik: deadline om 6 timmar." },
  { key: "t_minus_2h", offsetHours: -2, severity: "critical", targets: ["management_approver"], messageSv: "Eskalering till ledningsgodkännare: deadline om 2 timmar." },
  { key: "t_minus_1h", offsetHours: -1, severity: "critical", targets: ["incident_manager", "ciso", "legal_compliance", "management_approver"], messageSv: "Kritisk varning: deadline om 1 timme." },
  { key: "t_zero", offsetHours: 0, severity: "critical", targets: ["incident_manager", "ciso", "legal_compliance", "management_approver", "tenant_admin"], messageSv: "Deadline har passerats." },
  { key: "t_plus_1h", offsetHours: 1, severity: "critical", targets: ["incident_manager", "ciso", "legal_compliance"], messageSv: "Deadline missad för mer än 1 timme sedan. Uppgift för sen rapportering skapas." },
] as const;

export type EscalationStepKey = (typeof ESCALATION_STEPS)[number]["key"];

export interface EscalationEvent {
  key: EscalationStepKey;
  severity: "info" | "warning" | "critical";
  targets: readonly string[];
  messageSv: string;
}

/**
 * Given a due date, the current time, and the set of already-fired step keys,
 * returns the escalation steps that should fire now (idempotent).
 */
export function pendingEscalations(
  dueAt: Date,
  now: Date,
  alreadyFired: ReadonlySet<string>,
): EscalationEvent[] {
  const events: EscalationEvent[] = [];
  for (const step of ESCALATION_STEPS) {
    const fireAt = new Date(dueAt.getTime() + step.offsetHours * 3600_000);
    if (now >= fireAt && !alreadyFired.has(step.key)) {
      events.push({
        key: step.key,
        severity: step.severity,
        targets: step.targets,
        messageSv: step.messageSv,
      });
    }
  }
  return events;
}

export function isMissed(dueAt: Date, now: Date): boolean {
  return now.getTime() >= dueAt.getTime();
}

/** Internal SLA deadlines from tenant settings (spec §19). */
export function internalSlaDefinitions(settings: {
  sla_ciso_review_hours: number;
  sla_legal_review_hours: number;
  sla_management_approval_hours: number;
  sla_customer_communication_hours: number;
}): DeadlineDefinitionInput[] {
  return [
    { deadlineType: "sla_ciso_review", hoursFromSignificant: settings.sla_ciso_review_hours, titleSv: "CISO-granskning (intern SLA)" },
    { deadlineType: "sla_legal_review", hoursFromSignificant: settings.sla_legal_review_hours, titleSv: "Juridisk granskning (intern SLA)" },
    { deadlineType: "sla_management_approval", hoursFromSignificant: settings.sla_management_approval_hours, titleSv: "Ledningsgodkännande (intern SLA)" },
    { deadlineType: "sla_customer_communication", hoursFromSignificant: settings.sla_customer_communication_hours, titleSv: "Utkast kundkommunikation (intern SLA)" },
  ];
}
