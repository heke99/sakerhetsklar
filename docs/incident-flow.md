# Incident flow

1. **Create** (`/app/incidents`) — title, severity, type, timestamps, early
   indications (malicious? supplier origin? personal data? protected info?)
   and links to systems, critical services and vendors. A timeline event and
   audit entry are written; reference `INC-YYYY-NNNN` is assigned.
2. **Operate** — status engine (new → triage → investigating → contained →
   resolved → closed), tasks, comments, decision log. High/critical incidents
   can activate the **war room** (members, decisions with options/reason/
   approver, tasks, messages, linked reports/evidence).
3. **Assess significance** (`/app/incidents/[id]/assessment`) — the user
   answers impact questions (unknowns allowed); the significance engine
   evaluates the tenant's assigned rule packages and returns: recommendation
   (not_reportable / monitor / potentially_significant / significant_reportable
   / manual_review_required), matched rules with plain-language reasons and
   legal references, confidence, required approvers, next steps and deadline
   definitions. CISO/legal approve or reject; everything is logged.
4. **Deadlines** — on identification as significant, legal deadlines (24h/72h/
   1 month, 6h state agency, 24h eIDAS where applicable) and internal SLAs are
   instantiated. The escalation job reminds at T-24h/-12h/-6h/-2h/-1h,
   marks missed at T+0 and opens a late-reporting record at T+1h.
5. **Report** — see `reporting-flow.md`.
6. **Parallel tracks** — GDPR/IMY (with DPO approval and documented
   not-reporting decisions), recipient notification decisions, insurance and
   contractual notifications, state-agency track, eIDAS. Tracks are opened on
   the incident (`incident_regulatory_tracks`) and never merged.
7. **Evidence** — uploads are hashed (SHA-256), classified, access-logged and
   chained (chain of custody); legal hold supported.
8. **Close** — final report, remediation plan (action plans), late-reporting
   explanation if applicable, all exportable in the supervisory package.
