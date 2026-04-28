## Exploration: backup-export-import-v1

### Current State
La continuidad offline hoy depende de persistencia local en navegador, pero **sin flujo formal de backup/export/import**:

- El estado operativo offline se guarda en IndexedDB vía `OfflineStoreService` en DB `hato-offline` (stores `outbox`, `inbox`, `snapshots`, `sync_state`) y migra esquema con `migrateOfflineState` (`CURRENT_OFFLINE_SCHEMA_VERSION = 8`).
- Los binarios de imágenes se guardan aparte en otra IndexedDB (`hato-offline-image-binaries`, store `animal_image_binaries`) con `OfflineImageBinaryStoreService`.
- La sesión segura se controla por `AuthService` + `OfflineStoreService.clearForSessionBoundary(...)` y puede forzar `reauth_required`; cualquier restore/import debe respetar ese boundary para no reabrir sesión inválida.
- El runtime inicializa sync + stores derivados en `initializeApplicationRuntime(...)`; hoy no hay mecanismo para rehidratar todo desde un backup consistente ni para detectar/recuperar corrupción local más allá de migraciones de esquema.
- Backend ya expone sync/conflicts/observability, pero **no hay endpoint de backup**; el caso pedido es local-first, sin terceros y sin sync remota.

### Affected Areas
- `hato-fe/src/app/core/offline/offline-store.service.ts` — fuente de verdad del estado offline estructurado; necesita puntos de export/import atómicos.
- `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` — binarios están separados; V1 debe decidir cómo incluirlos o excluirlos explícitamente.
- `hato-fe/src/app/core/offline/offline-store.migrations.ts` — versionado/migración del snapshot restaurado para compatibilidad forward.
- `hato-fe/src/app/core/offline/offline-types.ts` — contrato de payload backup y metadatos de integridad/versionado.
- `hato-fe/src/app/core/auth/data-access/auth.service.ts` — reglas de sesión offline; import/restore no debe bypass de reautenticación.
- `hato-fe/src/app/app.initializers.ts` — orden de inicialización tras restore/import (rehidratación + refrescos derivados).
- `hato-fe/src/app/app.routes.ts` y `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` — punto de entrada UX (pantalla/acción admin de continuidad operativa).
- `hato-fe/src/app/core/offline/*.spec.ts` (+ nuevos specs de feature) — strict TDD exige cobertura RED→GREEN para export/import/restore y corrupción.

### Approaches
1. **Backup JSON unificado (estado estructurado + binarios opcionales embebidos base64)** — un archivo portable local.
   - Pros: UX simple (un archivo), restore directo, no depende de infraestructura externa.
   - Cons: puede crecer mucho por imágenes; encode/decode base64 consume memoria/tiempo.
   - Effort: Medium.

2. **Backup por paquete lógico (manifiesto JSON + payloads segmentados)** — separación entre estado y blobs.
   - Pros: mejor escalabilidad para imágenes, validación por partes, menor riesgo de OOM en restore.
   - Cons: UX más compleja en navegador (múltiples archivos/paquete), implementación más extensa para V1.
   - Effort: Medium/High.

### Recommendation
Tomar **Approach 1** en V1, con guardrails estrictos para mantener foco de continuidad local:

**In Scope V1**
1. **Export local manual** del estado offline en archivo descargable con:
   - metadatos (`backupVersion`, `createdAt`, `schemaVersion`, `appVersion`),
   - `outbox`, `inbox`, `snapshots`, `sync_state.meta/checkpoints`,
   - binarios de imágenes **opcionales** (feature flag V1: incluir/excluir).
2. **Import local manual** con validación fuerte:
   - estructura mínima requerida,
   - compatibilidad de versión de backup/esquema,
   - rechazo seguro de payload inválido/corrupto.
3. **Restore transaccional local**:
   - persistir snapshot completo o no persistir nada (evitar estado parcial),
   - reprocesar migraciones existentes luego de importar para normalizar.
4. **Recuperación ante pérdida/corrupción local**:
   - flujo explícito “restaurar desde backup” para volver a operación,
   - fallback controlado cuando el backup no pasa validaciones.
5. **Boundary de seguridad de sesión**:
   - restore/import no reactiva sesión autenticada automáticamente,
   - si corresponde, estado final en `reauth_required` y usuario debe loguearse.

**Out of Scope V1**
- Sincronización remota de backups entre dispositivos.
- Backups automáticos en nube/S3/Drive o terceros.
- Cifrado enterprise/KMS/rotación de claves gestionada.
- Disaster recovery enterprise (RPO/RTO formal, runbooks multi-región).
- Versionado incremental/deduplicación avanzada de backups.

### Risks
- **Tamaño de backup** por binarios de imágenes puede degradar UX o memoria en dispositivos modestos.
- **Restore parcial/corrupto** si no se implementa atomicidad y validación previa robusta.
- **Bypass de sesión** si restore repone metadatos sensibles sin respetar `reauth_required`.
- **Derivados inconsistentes** (reporting/calendario/notificaciones/conflictos) si no se rehidratan y refrescan en orden.
- **Scope creep** hacia “sync remota/disaster recovery enterprise” si no se mantiene el límite V1.
- **Strict TDD**: sin matriz de tests de corrupción/compatibilidad se pueden introducir regresiones silenciosas.

### Ready for Proposal
Yes — listo para `sdd-propose` definiendo contrato V1 de backup payload, reglas de validación/import, boundary de seguridad de sesión y UX mínima de continuidad operativa local.
