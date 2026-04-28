# Archive Report: analytics-decision-support-v1

## Summary

El cambio **analytics-decision-support-v1** fue archivado exitosamente en `openspec/changes/archive/2026-04-28-analytics-decision-support-v1/`.
La V1 queda definida como soporte de decisión **descriptivo/local-first**, con insights explicables, cache incremental y `sourceSignature`, guardrails explícitos anti-predictiva/anti-optimización/anti-integración externa, y sin regresión de reporting/offline/sync.

No se incluyeron capacidades fuera de alcance: **no BI predictiva**, **no optimización automática**, **no integraciones externas nuevas**.

## Artifact Sources (Pre-archive)

- `openspec/changes/analytics-decision-support-v1/exploration.md`
- `openspec/changes/analytics-decision-support-v1/proposal.md`
- `openspec/changes/analytics-decision-support-v1/specs/*/spec.md`
- `openspec/changes/analytics-decision-support-v1/design.md`
- `openspec/changes/analytics-decision-support-v1/tasks.md`
- `openspec/changes/analytics-decision-support-v1/apply-progress.md`
- `openspec/changes/analytics-decision-support-v1/verify-report.md`

## Specs Synced (Openspec Main Spec Merge)

| Domain | Action | Details |
|---|---|---|
| `analytics-decision-support-v1` | **Created** | Added complete new main spec (no previous file existed) with 5 requirements + 10 scenarios. |
| `admin-reporting-aggregates-v1` | **Modified** | Updated existing requirement `Bounded windows and predefined V1 filters`: added decision-support deterministic period comparison consistency and added scenario for bounded period-vs-period deterministic output. |
| `herd-descriptive-indicators-projection-v2` | **Modified** | Requirement now incluye metadatos explicativos (`source`/`rule`) y salida descriptiva-only para señales usadas en soporte de decisión; added scenario verifying explanation fields. |
| `admin-reporting-operational-events-v1` | **Modified** | Requirement `Explicit V1 exclusions...` explicitó exclusión de ejecución automática de decisiones, y agregó scenario de bloqueo de auto-apply para mantener decisiones manuales. |

## Merge/Archive Verification

- [x] Main specs updated in `openspec/specs/{domain}/spec.md`
- [x] Change folder moved to `openspec/changes/archive/2026-04-28-analytics-decision-support-v1`
- [x] Archived folder contains: `exploration.md`, `proposal.md`, `specs/*`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`
- [x] Active change folder removed from `openspec/changes/` root

## Verification Status and Compliance Snapshot

- `openspec/changes/analytics-decision-support-v1/verify-report.md` (pre-archive) marked final state as **PASS WITH WARNINGS**.
- All previously partial-compliant scenarios now treated as compliant per verify evidence (offline/local behavior, explainability, cache, anti-predictive/anti-auto execution, reporting/offline/sync non-regression).
- No CRITICAL issues blocking archive.

## Artifacts archived

- `proposal.md`
- `exploration.md`
- `design.md`
- `tasks.md` (21/21 completadas)
- `apply-progress.md`
- `verify-report.md`
- `specs/analytics-decision-support-v1/spec.md`
- `specs/admin-reporting-aggregates-v1/spec.md`
- `specs/herd-descriptive-indicators-projection-v2/spec.md`
- `specs/admin-reporting-operational-events-v1/spec.md`

## Engram traceability note

En este entorno, los artefactos requeridos de esta fase no estaban presentes en Engram en pre-archive (`sdd/analytics-decision-support-v1/*` no resolvió resultados). Se mantiene `archive-report` persistido en Engram para trazabilidad del cierre, incluyendo rutas y estado documental de cierre.
