# Tasks: Offline Session Security V1

## Defaults Closed in Tasks
- JWT/session expiry V1: 8h (alineada a backend).
- `shared_device_hard` purge: conservar solo config mínima no sensible.
- UX: `expired` y `reauth_required` se muestran como estados distintos.

## Phase 1: Foundation (policy + contracts)
- [x] 1.1 **RED** `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts`: cubrir envelope (`active|reauth_required|expired`), TTL 8h, transición por tiempo y por lock de frontera (`logout|user_switch`).
- [x] 1.2 **GREEN** `hato-fe/src/app/core/auth/data-access/auth.service.ts`: implementar `OfflineSessionEnvelope`, `evaluateOfflineSession(now)`, persistencia/restore y source of truth única.
- [x] 1.3 **REFACTOR** `auth.service.ts` + tipos compartidos: extraer helpers puros de evaluación, normalizar razones y evitar duplicación de checks.

## Phase 2: Guard + initializer consistency
- [x] 2.1 **RED** `hato-fe/src/app/core/auth/guards/auth.guard.spec.ts`: permitir navegación solo en `active`; negar y redirigir en `expired/reauth_required`.
- [x] 2.2 **GREEN** `hato-fe/src/app/core/auth/guards/auth.guard.ts`: reemplazar check ad-hoc por policy central de sesión.
- [x] 2.3 **RED** `hato-fe/src/app/app.initializers.spec.ts` (crear si falta): al boot offline, marcar no-activa antes de iniciar sync.
- [x] 2.4 **GREEN** `hato-fe/src/app/app.initializers.ts`: evaluar/normalizar sesión previo a runtime offline/sync.

## Phase 3: Sync gate + shared-device cleanup
- [x] 3.1 **RED** `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts`: bloquear push/pull con `expired/reauth_required`; habilitar tras reauth exitosa.
- [x] 3.2 **GREEN** `hato-fe/src/app/core/offline/sync-orchestrator.service.ts`: aplicar gate estricto por estado envelope y emitir motivo UX (`expired` vs `reauth_required`).
- [x] 3.3 **RED** `hato-fe/src/app/core/offline/offline-store.service.spec.ts`: matriz `soft_retention` vs `shared_device_hard`; `shared_device_hard` conserva solo config mínima no sensible.
- [x] 3.4 **GREEN** `hato-fe/src/app/core/offline/offline-store.service.ts`: implementar `clearForSessionBoundary(policy)` y purge selectivo de outbox/inbox/snapshots/meta sensible.
- [x] 3.5 **GREEN** `hato-fe/src/app/core/offline/offline-store.migrations.ts`: migración schema v8 con fallback seguro a `reauth_required`.

## Phase 4: UX contract + minimal BE alignment
- [x] 4.1 **RED** `hato-fe/src/app/features/admin/auth/login-page/login-page.component.spec.ts`: copy y comportamiento diferenciados para `expired` y `reauth_required`.
- [x] 4.2 **GREEN** `hato-fe/src/app/features/admin/auth/login-page/login-page.component.ts`: mensaje contextual de reautenticación y retorno al flujo principal.
- [x] 4.3 **RED/GREEN (mínimo BE si aplica)** `hato-be/src/test/**`: test de contrato que verifique expiración JWT esperada (8h) o valor configurado equivalente; ajustar config/documentación solo si hay desalineación real.

## Phase 5: Verification + hardening
- [x] 5.1 Ejecutar suite FE focalizada (auth guard/service, initializer, sync orchestrator, offline store, login UX) y corregir flakes.
- [x] 5.2 Verificar escenarios spec end-to-end en pruebas integradas FE: boot expirado, bloqueo sync, reauth, desbloqueo, limpieza shared-device.
- [x] 5.3 Documentar límites V1 (exclusiones de biometría/MDM/keystore/revocación remota) en docs técnicas del cambio.
