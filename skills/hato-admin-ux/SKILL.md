---
name: hato-admin-ux
description: "Trigger: admin/ganadero visual or list pages, DataTable, modal actions, Hato operational UX. Align operational list screens with the pd-fe-inspired Hato pattern."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract

Use this skill when creating or modifying Hato FE operational list/detail pages for admin or ganadero users, shared tables, notification/reporting views, or visual patterns under `hato-fe/src/app/features/admin/**`, `hato-fe/src/app/features/ganadero/**`, and ganadero routes that reuse admin feature components.

## Hard Rules

- Keep route shell/header as the page title source; do not add duplicate top-level `h1`/subtitle blocks inside operational pages.
- Prefer a thin page wrapper: status/feedback cards, one primary CTA aligned top-right, then a shared `app-data-table` or structured KPI panels.
- Use real data from existing stores/services. Do not ship placeholder cards, static tabs, or raw object/debug dumps.
- Reuse Hato dependencies only. Use pd-fe as visual reference, not as code to copy wholesale.
- Keep components standalone, signal-friendly, and feature-scoped per `angular-hato`.
- Creation/edit actions should open in `MatDialog` when comparable operational pages use dialogs.
- Do not embed creation/edit forms inside list pages unless there is a strong workflow reason documented in the implementation summary.

## Decision Gates

| Situation | Action |
|---|---|
| Tab has no real distinct workflow | Remove it or merge content into the main admin list page. |
| Data is tabular/list-like | Use `app-data-table` with loading, empty state, filters/sort where useful, and icon+label row actions. |
| Ganadero route displays list/table-like operational data | Use the same shared `app-data-table` pattern or reuse the admin component already using it. |
| Create/edit workflow exists next to a list/table | Prefer a top-right CTA that opens a `MatDialog`; keep the page focused on status, feedback, toolbar, and table. |
| Data is summary/analytics | Use KPI cards plus a table/structured panel for drill-down. |
| Operation requires online/backend support | Disable the CTA and show a short status note instead of fake behavior. |

## Execution Steps

1. Read the touched page, its service/store, and current specs before editing.
2. Preserve existing tests and public component inputs unless the UX requirement explicitly needs a change.
3. Align list pages around: concise status card, top-right CTA, modal action forms, table card, integrated loading/empty/error/feedback states.
4. Keep filters in the shared DataTable; avoid per-page bespoke filtering unless business logic requires it.
5. Apply this to admin and ganadero operational/list pages; dashboard KPI widgets are exempt unless they display a real list/table.
6. Run targeted Angular tests for touched operational/DataTable components when feasible; never run a full build unless explicitly requested.

## Output Contract

Report changed admin/ganadero areas, UX behavior added, tests/checks run, and any unsupported pd-fe pattern intentionally omitted.

## References

- `skills/angular-hato/SKILL.md`
- `hato-fe/AGENTS.md`
