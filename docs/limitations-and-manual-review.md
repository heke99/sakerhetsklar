# Limitations and manual review

Säkerhetsklar provides decision support. **Final legal and regulatory
responsibility remains with the organization.** The platform never provides
final legal advice, and every assessment screen states this.

## Explicit limitations

1. **Cyberportalen API is not assumed in MVP.** Reporting is copy/export based
   with stage-specific incident IDs, receipts and a reserve procedure.
2. **PTS sector rules are draft/pending.** The PTS rule track is marked
   `draft` + `partially_supported`/`pending_regulatory_guidance` per sector
   (telecom, post/courier, space). Matched draft rules always produce
   `manual_review_required` and lower confidence. The package is flagged
   `requires_update_when_final`.
3. **EU 2024/2690**: detailed thresholds are seeded for Art. 3 (general),
   Art. 4 (recurring), Art. 7 (cloud) and Art. 10 (MSP/MSSP). Articles 5, 6,
   8, 9, 11, 12, 13 and 14 are seeded structurally as manual-review rules —
   thresholds are not invented.
4. **MCFFS 2026:8 sector thresholds** are seeded for public administration,
   energy (el/fjärrvärme/fjärrkyla, gas/vätgas, olja), transport, healthcare,
   drinking water and waste water. Sectors without a seeded official
   threshold (banking, financial market infrastructure, waste management,
   chemicals, food, manufacturing, research, space, postal/courier) get a
   manual-review rule instead of a guessed threshold.
5. **MCFFS 2026:11/12** enter into force 1 October 2026 and are marked
   `pending_guidance` until then; controls sourced from them carry the same
   status.
6. **GDPR/IMY is a separate track.** It is never merged with NIS2 reporting;
   the 72h clock runs from awareness, and not-reporting decisions require a
   documented reason and approver.
7. **State-agency reporting (MCFFS 2026:7)** is a separate track with 6h
   warning logic; reports are not merged with NIS2 reports unless explicitly
   configured.
8. **eIDAS/trust services** run as a parallel track with their own deadlines;
   qualified/non-qualified classification requires manual review.
9. **CER, DORA and security protection** are manual-review flags only.
10. **Security-classified information must not be uploaded** unless the
    deployment and handling process are approved for it. The UI warns on the
    relevant classifications and the evidence bank blocks by policy.
11. **AI assistance is not enabled by default.** If enabled it may only draft
    and summarize; it cannot approve, submit or invent legal references, and
    output is labeled "AI-förslag — kräver mänsklig granskning".
12. **Draft/pending rules must be reviewed by a human** before being relied
    upon; the rule admin updates packages when final rules are published and
    can preview impacted tenants before publishing.
