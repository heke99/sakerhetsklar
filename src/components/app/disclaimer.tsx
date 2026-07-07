/**
 * Mandatory decision-support disclaimer. Must be rendered on every assessment
 * screen (scope, significance, reporting, GDPR, readiness).
 */
export function DecisionSupportDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
    >
      Säkerhetsklar tillhandahåller beslutsstöd. Det slutliga juridiska och
      regulatoriska ansvaret ligger kvar hos organisationen.
    </p>
  );
}
