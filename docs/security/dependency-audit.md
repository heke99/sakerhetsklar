# Dependency audit status

Last reviewed: 2026-07-09 (production-readiness batch 16).

CI runs `npm audit --audit-level=high` on every push/PR and fails on
high/critical findings. Dependabot opens weekly grouped update PRs.

## Current findings (moderate — accepted with rationale)

| Package | Severity | Advisory | Path | Impact assessment | Decision |
| --- | --- | --- | --- | --- | --- |
| `postcss < 8.5.10` | Moderate | GHSA-qx2v-qp2m-jg93 (XSS via unescaped `</style>` in stringified output) | `next > postcss` (build-time only) | PostCSS runs at build time on our own trusted CSS sources; no untrusted CSS is ever stringified. Not exploitable in this product. | Accept until Next.js ships a patched transitive dependency; `npm audit fix --force` would downgrade Next.js to 9.x (breaking). |
| `uuid < 11.1.1` | Moderate | GHSA-w5hq-g745-h8pq (missing buffer bounds check in v3/v5/v6 with `buf`) | `exceljs > uuid` | ExcelJS does not call uuid v3/v5/v6 with caller-supplied buffers in our usage (Excel import/export of registers). Not exploitable in this product. | Accept until ExcelJS updates; the forced fix downgrades ExcelJS to 3.x (breaking). |

## Process

1. High/critical findings block CI — they must be fixed or the dependency
   removed before merge.
2. Moderate findings are assessed here with impact and decision; re-review at
   least quarterly and when Dependabot proposes the transitive fix.
3. Never use `npm audit fix --force` blindly — both current findings would be
   "fixed" by breaking downgrades.
