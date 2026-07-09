/**
 * Shared Swedish labels for system enum values shown to customers.
 * UI must never show raw English database values to normal users.
 */

export const INCIDENT_STATUS_SV: Record<string, string> = {
  new: "Ny",
  triage: "Triagering",
  investigating: "Utredning pågår",
  contained: "Begränsad",
  mitigating: "Åtgärdas",
  resolved: "Löst",
  closed: "Stängd",
  reopened: "Återöppnad",
};

export const SEVERITY_SV: Record<string, string> = {
  low: "Låg",
  medium: "Medel",
  high: "Hög",
  critical: "Kritisk",
};

export const REPORT_STATUS_SV: Record<string, string> = {
  draft: "Utkast",
  ready_for_review: "Klar för granskning",
  approved: "Godkänd",
  submitted_in_cyberportalen: "Inskickad",
  cyberportal_incident_id_saved: "Ärende-ID sparat",
  receipt_uploaded: "Kvitto uppladdat",
  late: "Försenad",
  closed: "Stängd",
};

export const SIGNIFICANCE_SV: Record<string, string> = {
  not_assessed: "Ej bedömd",
  significant: "Betydande",
  not_significant: "Ej betydande",
  potentially_significant: "Potentiellt betydande",
  manual_review_required: "Manuell bedömning krävs",
  monitor: "Bevaka",
  reportable: "Rapporteringspliktig",
  not_reportable: "Ej rapporteringspliktig",
};

export const PLAN_SV: Record<string, string> = {
  starter: "Bas",
  business: "Verksamhet",
  enterprise: "Enterprise",
};

export const RISK_LEVEL_SV: Record<string, string> = {
  low: "Låg",
  medium: "Medel",
  high: "Hög",
  critical: "Kritisk",
};

export const RISK_STATUS_SV: Record<string, string> = {
  open: "Öppen",
  in_treatment: "Under åtgärd",
  accepted: "Accepterad",
  mitigated: "Reducerad",
  closed: "Stängd",
};

export const TASK_STATUS_SV: Record<string, string> = {
  open: "Öppen",
  in_progress: "Pågår",
  done: "Klar",
  cancelled: "Avbruten",
};

export const CLASSIFICATION_SV: Record<string, string> = {
  open: "Öppen",
  internal: "Intern",
  confidential: "Konfidentiell",
  strictly_confidential: "Strikt konfidentiell",
  security_sensitive: "Säkerhetskänslig",
  potentially_security_classified: "Ev. säkerhetsskyddsklassificerad",
};

export const SUPPORT_STATUS_SV: Record<string, string> = {
  requested: "Begärd",
  approved: "Godkänd",
  denied: "Nekad",
  revoked: "Återkallad",
  expired: "Utgången",
};

export const EXERCISE_STATUS_SV: Record<string, string> = {
  planned: "Planerad",
  in_progress: "Pågår",
  completed: "Genomförd",
  cancelled: "Avbruten",
};

export const DEADLINE_STATUS_SV: Record<string, string> = {
  pending: "Väntar",
  met: "Uppfylld",
  missed: "Missad",
  cancelled: "Avbruten",
};

export const ONBOARDING_STATUS_SV: Record<string, string> = {
  not_started: "Ej påbörjad",
  in_progress: "Pågår",
  blocked: "Blockerad",
  complete: "Klar",
};

/** Generic lookup with safe fallback to the raw value. */
export function svLabel(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "–";
  return map[value] ?? value;
}
