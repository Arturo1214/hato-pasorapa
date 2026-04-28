# Apply Progress: Offline Session Security V1

## Status
- Mode: Strict TDD
- Progress: 15/15 tasks complete
- Ready for re-verify after shared-device hygiene corrective batch

## Completed Tasks
- [x] 1.1-1.3 Session envelope local, TTL 8h, helpers puros y source of truth central en `AuthService`.
- [x] 2.1-2.4 Gate unificado en guard + initializer con redirect contextual y normalización pre-sync.
- [x] 3.1-3.5 Bloqueo estricto de sync por sesión no activa, purge selectivo por política y migración offline schema v8.
- [x] 4.1-4.3 UX diferenciada para `expired` vs `reauth_required` y contrato BE de expiración JWT 8h.
- [x] 5.1-5.3 Suite focalizada ejecutada, escenarios integrados cubiertos y límites V1 documentados.

## Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modified | Envelope offline persistido, evaluación TTL, restore seguro y redirect logout/reauth policy. |
| `hato-fe/src/app/core/auth/guards/auth.guard.ts` | Modified | Redirect con `session` + `returnUrl` usando la policy central. |
| `hato-fe/src/app/app.initializers.ts` | Modified | Normaliza sesión antes de inicializar sync runtime. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Gate por `OfflineSessionStatus` con mensajes UX diferenciados. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | `clearForSessionBoundary()` con `soft_retention` y `shared_device_hard`. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Schema v8 con fallback seguro `reauth_required`. |
| `hato-fe/src/app/features/admin/auth/login-page/*` | Modified | Copy contextual y retorno al `returnUrl` post-reauth. |
| `hato-fe/src/app/app.auth.integration.spec.ts` | Modified | Escenarios integrados de redirect/reauth y guard offline. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | Modified | Contrato `expiresInSeconds = 28800` alineado a 8h. |
| `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts` | Modified | Cobertura correctiva para cleanup en logout, cleanup por user switch y restauración bloqueada de sesión previa. |
| `openspec/changes/offline-session-security-v1/specs/offline-session-security-v1/spec.md` | Modified | Se espejó el dominio `shared-device-session-hygiene-v1` para alinear OpenSpec con Engram en modo hybrid. |

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `auth.service.spec.ts` | Unit | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Helpers puros extraídos |
| 1.2 | `auth.service.spec.ts` | Unit | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ Active/expired/lock | ✅ Persist/restore centralizado |
| 1.3 | `auth.service.spec.ts` | Unit | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ 2 boundary reasons | ✅ Razones normalizadas |
| 2.1 | `auth.guard.spec.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ Active/expired | ✅ Redirect contextual |
| 2.2 | `auth.guard.spec.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ Return URL + status | ✅ Check ad-hoc removido |
| 2.3 | `app.initializers.spec.ts` | Unit | ✅ 1/1 | ✅ Written | ✅ Passed | ✅ Orden config/session/sync | ➖ None needed |
| 2.4 | `app.initializers.spec.ts` | Unit | ✅ 1/1 | ✅ Written | ✅ Passed | ✅ Boot sequence | ➖ None needed |
| 3.1 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 36/36 | ✅ Written | ✅ Passed | ✅ expired/reauth_required | ✅ Gate común reutilizado |
| 3.2 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 36/36 | ✅ Written | ✅ Passed | ✅ Mensajes UX distintos | ✅ Early-return simplificado |
| 3.3 | `offline-store.service.spec.ts` | Unit | ✅ 9/9 | ✅ Written | ✅ Passed | ✅ soft vs hard | ✅ Meta retenida centralizada |
| 3.4 | `offline-store.service.spec.ts` | Unit | ✅ 9/9 | ✅ Written | ✅ Passed | ✅ Snapshots/read-state retained vs purged | ✅ Policy builder extraído |
| 3.5 | `offline-store.migrations.spec.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ create + migrate | ✅ Normalización v8 |
| 4.1 | `login-page.component.spec.ts` | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ expired vs reauth_required | ✅ Query param handling reactivo |
| 4.2 | `login-page.component.spec.ts` | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ returnUrl + feedback | ✅ Copy contextual separado |
| 4.3 | `AuthResourceTest.java` | Integration | ✅ 8/8 | ✅ Written | ✅ Passed | ➖ Single | ➖ None needed |
| 5.1 | Focused FE suite | Unit/Integration | ✅ 36/36 | ✅ Written | ✅ Passed | ✅ 47/47 final suite | ➖ Suite run |
| 5.2 | `app.auth.integration.spec.ts` | Integration | ✅ 3/3 | ✅ Written | ✅ Passed | ✅ guest + expired flow | ✅ Guard/login consistency |
| 5.3 | `design.md` | Docs | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ➖ None needed |
| corrective-1 | `auth.service.spec.ts` | Unit | ✅ 21/21 | ✅ Written | ✅ 8/8 auth spec | ✅ logout + user_switch + prior session | ✅ Router dummy + mock hygiene |
| corrective-2 | `offline-session-security-v1/spec.md` | Docs | N/A (existing) | ✅ Written | ✅ Aligned | ➖ Mirrored domain | ➖ None needed |

## Test Summary
- **Frontend corrective focused suite**: `35/35` passing (`auth.service`, `sync-orchestrator`, `offline-store`)
- **Backend auth contract suite**: `4/4` passing (`AuthResourceTest` con `jenv shell 21.0.5`)
- **Approval tests**: None — behavior changed intentionally per spec
- **Pure functions created**: `buildOfflineSessionEnvelope`, `lockOfflineSessionEnvelope`, `evaluateOfflineSession`

## Deviations from Design
None — implementation matches design intent. La metadata `sessionSecurity` de schema v8 queda en offline meta para fallback seguro y auditoría del boundary local.

## Issues Found
None. La única advertencia de ejecución fue la relocalización de `quarkus-junit5` reportada por Maven, sin impacto funcional en esta corrección.

## Corrective Notes
- Se cubrieron explícitamente los escenarios que verify marcó como faltantes: `Logout triggers cleanup`, `User switch on shared device` y `Prior session cannot sync`.
- OpenSpec quedó reconciliado con Engram espejando el dominio `shared-device-session-hygiene-v1` dentro del delta principal para evitar lecturas parciales en verify híbrido.
