# Dataresidens

- Standardleverans: all kunddata lagras i EU/EES-regioner.
- Model A (delad SaaS): gemensam EU-region för alla tenanter.
- Model B (single-tenant): region väljs per kund vid provisionering.
- Model C (kundägd datamiljö): kunden äger och väljer region, inklusive
  on-premise-drift (C2/C3).
- Styrplanen (tenantregister, hälsostatus, versioner) lagras i EU och innehåller
  ingen känslig tenantdata.
- Bevisfiler lagras i samma region som tenantens datamiljö.
- Systemregistret i plattformen dokumenterar dataresidens per system för kundens
  egen verksamhet (fält `data_residency`).
