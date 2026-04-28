# Design: Offline Session Security V1

## Technical Approach
Implementar una política única de sesión offline en FE basada en un **session envelope local** persistido en `localStorage` y validado por una **fuente única de verdad** consumida por `authGuard`, `app.initializers` y `SyncOrchestratorService`. El sync queda bloqueado si la sesión no está `active`; en esos casos se exige login explícito (reauth) antes de push/pull. En paralelo, se endurece la higiene local para dispositivo compartido con limpieza dirigida de IndexedDB + estado local sensible.

## Architecture Decisions

| Decision | Option | Tradeoff | Chosen |
|---|---|---|---|
| Modelo de sesión offline | Derivar todo desde JWT en cada uso / envelope local persistido | Solo JWT simplifica storage pero dispersa reglas; envelope agrega estructura | **Envelope local** con `status`, `issuedAt`, `expiresAt`, `lastValidatedAt`, `userId` |
| Fuente de validación | Checks separados en guard/init/sync / policy central | Checks separados generan bypass; policy central requiere refactor | **Policy central** (`evaluateOfflineSession`) reutilizada por guard/init/sync |
| Gate de sync | Permitir pull sin sesión y bloquear solo push / bloquear ciclo completo | Pull sin sesión mantiene frescura pero abre fuga de datos en shared device | **Bloqueo total de sync** cuando `status !== active` |
| Limpieza local | Borrado total siempre / limpieza selectiva por categoría | Borrado total es simple pero rompe continuidad offline; selectiva es más compleja | **Selectiva por política V1** con purge fuerte en logout/cambio de usuario |

## Data Flow

```
Login success
  -> AuthService.persistSession()
  -> buildSessionEnvelope(expiresInSeconds, user)
  -> localStorage[hato-session, hato-session-envelope]

App startup
  -> AuthService.restoreSession()
  -> evaluateOfflineSession(now)
  -> status: active | reauth_required | expired
  -> initializeApplicationRuntime()
       -> SyncOrchestrator.initialize()
       -> syncNow() only if session status === active

Manual/reconnect sync
  -> SyncOrchestrator.syncNow(trigger)
  -> evaluateOfflineSession(now)
  -> if non-active: abort + emit "reauth required" event/state
  -> else push/pull normal

Logout / user switch
  -> AuthService.logout({ reason })
  -> OfflineStoreService.clearForSessionBoundary(policy)
  -> clear local auth/session envelope
  -> navigate('/login')
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modify | Agregar `OfflineSessionEnvelope`, evaluación de vigencia, estado observable de sesión (`active/reauth_required/expired`) y logout con limpieza offline. |
| `hato-fe/src/app/core/auth/guards/auth.guard.ts` | Modify | Reemplazar check ad-hoc por política central de sesión; redirigir a login cuando no esté `active`. |
| `hato-fe/src/app/app.initializers.ts` | Modify | Evaluar/normalizar estado de sesión antes de inicializar sync y stores dependientes. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Introducir `SyncSessionGate` (lectura de token + estado envelope) para bloquear startup/reconnect/manual sync en sesión no activa. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Exponer `clearForSessionBoundary` con políticas (`soft_retention`, `shared_device_hard`) para outbox/inbox/snapshots/meta sensibles. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | Subir schema (`v8`) y normalizar metadatos de sesión/higiene, manteniendo backward compatibility. |
| `hato-fe/src/app/features/admin/auth/login-page/login-page.component.ts` | Modify | Soportar UX de reautenticación (mensaje contextual + retorno al flujo principal tras éxito). |
| `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts` | Modify | Cobertura de expiración, transición a `reauth_required`, y limpieza en logout. |
| `hato-fe/src/app/core/auth/guards/auth.guard.spec.ts` | Modify | Cobertura de acceso permitido solo con sesión `active`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modify | Cobertura de sync gate por estado de sesión y desbloqueo tras reauth. |
| `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Modify | Cobertura de matriz de limpieza (retención mínima vs purge hard). |

## Interfaces / Contracts

```ts
export type OfflineSessionStatus = 'active' | 'reauth_required' | 'expired';

export interface OfflineSessionEnvelope {
  userId: string;
  status: OfflineSessionStatus;
  issuedAt: string;
  expiresAt: string;
  lastValidatedAt: string;
  reason?: 'ttl_elapsed' | 'logout' | 'user_switch' | 'manual_lock';
}

export interface SyncSessionGate {
  getAccessToken(): string | null;
  getOfflineSessionStatus(): OfflineSessionStatus;
}
```

Política TTL V1: `expiresAt = loginTime + expiresInSeconds` (alineada a backend, hoy 8h). Si `now >= expiresAt` ⇒ `expired`; si hay token válido pero lock por frontera de sesión/shared device ⇒ `reauth_required`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Evaluación de envelope y transiciones de estado | Tests puros de policy con reloj controlado (`now` inyectable). |
| Unit | Gate de sync por `active/reauth_required/expired` | Extender specs de `SyncOrchestratorService` validando abort y reintento tras login. |
| Integration (FE) | Inicialización runtime + guard + login | Flujo: sesión expirada -> redirect login -> login exitoso -> acceso + sync manual habilitado. |
| Unit | Limpieza local por política | Verificar purga de `outbox/inbox/snapshots/checkpoints/meta` y retención mínima de datos no sensibles. |

## Migration / Rollout
No migration de backend requerida. En FE, migración de estado offline a `schemaVersion 8` con fallback seguro: si faltan metadatos de sesión, inicializar en `reauth_required` para evitar bypass. Rollout en un único release FE, sin feature flag adicional.

## Security Boundaries / Explicit Exclusions
- V1 **no** cubre biometría del SO ni keystore/hardware-backed encryption.
- V1 **no** implementa atestación/MDM, remote revocation, ni recovery remoto de sesión.
- V1 protege el borde local offline con TTL de 8h, envelope persistido, gate unificado y purge selectivo; cualquier endurecimiento extra queda para iteraciones posteriores.

## Open Questions
- [ ] Confirmar matriz final de “datos sensibles” a purgar en `shared_device_hard` (incluye/not incluye snapshots de calendario y notificaciones).
- [ ] Definir copy UX final para motivo de bloqueo (`expirada` vs `requiere reautenticación por dispositivo compartido`).
