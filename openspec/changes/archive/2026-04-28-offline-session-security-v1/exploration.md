## Exploration: offline-session-security-v1

### Current State
El sistema ya opera offline-first con sync centralizado (`SyncOrchestratorService`) y autenticación JWT de 8h emitida por backend (`AuthService`/`AuthResource`).

Brechas actuales relevantes para seguridad de sesión offline:
- FE persiste `token` + `user` en `localStorage` (`hato-session`) y **no persiste ni valida** una expiración local de sesión (`expiresInSeconds` llega del backend pero hoy se ignora en el modelo de sesión).
- El sync se habilita por presencia de token (`getAccessToken()`), no por vigencia de sesión; no hay compuerta explícita de “reauth antes de push/pull”.
- `logout()` limpia `hato-session`, pero no existe limpieza de IndexedDB offline (`hato-offline`) por sesión/usuario.
- El almacenamiento offline usa un único namespace de DB (`hato-offline`) con snapshots/inbox/outbox/meta compartidos localmente; no hay aislamiento formal por usuario/dispositivo para modo compartido.

### Affected Areas
- `hato-fe/src/app/core/auth/data-access/auth.service.ts` — modelo/persistencia de sesión, logout y restauración de sesión.
- `hato-fe/src/app/core/auth/guards/auth.guard.ts` — gate de rutas basado en estado autenticado.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — compuerta actual de sync (`token` presente) y punto natural para exigir reautenticación previa.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — persistencia IndexedDB central; requiere API explícita de limpieza/retención.
- `hato-fe/src/app/core/offline/offline-store.migrations.ts` — versionado de schema/meta para política de sesión offline V1.
- `hato-fe/src/app/app.initializers.ts` — orden de arranque donde hoy se inicializan runtime/sync/stores.
- `hato-be/src/main/java/bo/pasorapa/hato/service/AuthService.java` — TTL de token actual (8h) y contrato de login.
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AuthResource.java` — endpoints de auth existentes (sin nueva integración externa requerida para V1).

### Approaches
1. **Session envelope local + sync gate estricto (recomendado)** — agregar estado de sesión offline en FE (timestamps de emisión/expiración/última reauth), bloquear push/pull si sesión vencida o en ventana de reauth, y ejecutar limpieza local según política de dispositivo compartido.
   - Pros: mantiene offline-first para captura local, reduce riesgo de sync con sesión inválida, no requiere integraciones externas.
   - Cons: agrega complejidad de estado local y migración de schema/meta en FE.
   - Effort: Medium

2. **Endurecer solo con expiración JWT “best effort”** — validar expiry del token en guard/sync y forzar login cuando expire, sin política completa de limpieza ni reglas explícitas de shared device.
   - Pros: implementación más rápida.
   - Cons: deja huecos de datos locales residuales y reglas ambiguas para dispositivo compartido; cobertura de seguridad insuficiente para el objetivo.
   - Effort: Low

### Recommendation
Tomar **Approach 1** con alcance V1 bien delimitado.

**In Scope V1**
1. Política de sesión offline local (TTL, estado `active|reauth_required|expired`) y validación consistente en guard + sync gate.
2. Reautenticación obligatoria antes de sync cuando la sesión esté en estado `reauth_required|expired` (sin proveedores externos; usando login actual).
3. Limpieza local explícita al cerrar sesión y en transiciones críticas (mínimo: sesión + outbox/inbox/snapshots/meta sensibles), preservando sólo lo que el alcance offline-first permita sin fuga de datos.
4. Reglas V1 para dispositivo compartido: comportamiento por defecto seguro (no reutilizar sesión previa automáticamente para sync) y contrato UX explícito.
5. Límites de seguridad documentados de V1 (qué protege y qué no), evitando prometer hardening de nivel MDM/biometría.

**Out of Scope V1**
- Integraciones externas (IdP, MDM, attestation de dispositivo, biometría del SO, revocación remota avanzada).
- Criptografía de datos offline con gestión de llaves remota.
- Sincronización cross-device de estado de sesión.

### Risks
- **Borrado excesivo**: limpiar demasiado puede degradar UX offline legítima si no se define una política de retención mínima por caso.
- **Borrado insuficiente**: dejar snapshots/meta sin limpiar en dispositivo compartido expone datos de otra cuenta.
- **Inconsistencia de compuertas**: si guard, inicializadores y sync no comparten la misma máquina de estados, habrá bypasses.
- **Scope creep**: intentar meter cifrado fuerte/biometría/remoto en V1 rompe el objetivo incremental.
- **Strict TDD pressure**: con `strict_tdd: true`, la matriz de tests de sesión/sync/logout/migraciones debe quedar explícita desde proposal/spec.

### Ready for Proposal
Yes — el alcance V1 está delimitado para pasar a `sdd-propose` con foco en política de sesión offline, reautenticación pre-sync, limpieza local y reglas de dispositivo compartido sin integraciones externas.
