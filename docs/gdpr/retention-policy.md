# Retentionpolicy

## Principer

- Data sparas så länge den behövs för ändamålet eller enligt kundens
  konfiguration, därefter raderas den.
- Retention konfigureras per objekttyp i `retention_policies`
  (tenant-specifik eller global standard).
- Legal hold har alltid företräde framför retention och radering.

## Standardvärden (justerbara)

| Objekttyp | Standardretention |
| --- | --- |
| Bevis (evidence) | 5 år (`tenant_settings.evidence_retention_days`) |
| Incidenter och rapporter | 5 år |
| Revisionsloggar | 2 år |
| Åtkomst-/export-/nedladdningsloggar | 1 år |
| Notifieringar | 90 dagar |

Motivering: NIS2-tillsyn och eventuella sanktionsärenden kan kräva historik
flera år bakåt; kortare loggretention balanserar integritetskrav.

## Radering

- Mjuk radering (`deleted_at`) följt av definitiv radering enligt policy.
- Exit: se `docs/exit-plan/export-and-deletion.md`.
