# Design: Backup Export/Import V1 (Local Continuity)

## Technical Approach

Implementar un paquete de backup V1 100% local (JSON único) sobre los stores existentes (`hato-offline` + `hato-offline-image-binaries`) con pipeline en 4 pasos: **exportar → validar completo → restore atómico → rehidratar + forzar sesión**. La implementación sigue el patrón actual de `OfflineStoreService` (adapter IndexedDB + caché en memoria) y reutiliza `migrateOfflineState()` para compatibilidad de esquema.

## Architecture Decisions

| Opción | Tradeoff | Decisión |
|---|---|---|
| Backup por múltiples archivos | Mejor para binarios grandes, peor UX y más errores de usuario | **No** |
| JSON único versionado | UX simple, portable; payload más grande | **Sí (V1)** |
| Validación incremental durante restore | Menos memoria, riesgo de estado parcial | **No** |
| Validación previa total + restore | Más costo upfront, elimina mutación parcial | **Sí** |
| Restore por escrituras store-by-store sin tx única | Implementación simple, rollback difícil | **No** |
| Transacción coordinada sobre ambos DBs | Más complejidad, all-or-nothing | **Sí** |
| Mantener sesión activa tras import | Mejor UX corto plazo, rompe boundary de seguridad | **No** |
| Forzar `reauth_required` tras restore | Fricción controlada, protege sync y cambio de dispositivo | **Sí** |

## Data Flow

```text
ADMIN UI
  -> OfflineBackupService.export()
      -> OfflineStoreService.getStateSnapshotForBackup()
      -> OfflineImageBinaryStoreService.listForBackup() [optional]
      -> BackupManifestBuilder + integrity map
      -> download JSON

ADMIN UI
  -> OfflineBackupService.import(file)
      -> BackupValidator.validate(payload, manifest)
      -> OfflineStoreService.restoreFromBackupTx(...)
      -> OfflineImageBinaryStoreService.restoreBinarySetTx(...)
      -> migrateOfflineState() + normalizations
      -> RuntimeRehydrationCoordinator.rebuildAll()
      -> AuthService.forceReauth("manual_lock")
```

Secuencia de restore:
1) Parse/validate contrato y versión. 2) Verificar integridad de referencias imagen↔operación. 3) Abrir transacción de restore y reemplazar estado completo. 4) Recalcular derivados (`calendar`, `notifications`, `reporting`, `conflicts`). 5) Forzar `reauth_required` antes de próximo sync.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/backup/offline-backup.types.ts` | Create | Contratos `BackupEnvelopeV1`, `BackupManifest`, `BackupIntegrityReport`, errores tipados. |
| `hato-fe/src/app/core/offline/backup/offline-backup.validator.ts` | Create | Validación estructural, versionado (`backupVersion`, `sourceSchemaVersion`) e integridad de imágenes. |
| `hato-fe/src/app/core/offline/backup/offline-backup.service.ts` | Create | Casos de uso export/import, opciones `includeImages`, límites y orquestación del restore. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Exponer snapshot exportable y método `restoreFromBackupTx` (reemplazo atómico de stores + meta). |
| `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` | Modify | Soporte `listForBackup`/`restoreBinarySet` para binarios opcionales. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | `CURRENT_OFFLINE_SCHEMA_VERSION` + regla de compatibilidad import (acepta <= current). |
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modify | Nuevo método explícito para `forceReauthAfterRestore()` persistiendo envelope `reauth_required`. |
| `hato-fe/src/app/app.initializers.ts` | Modify | Registrar coordinador de rehidratación post-restore para recomputar stores en orden. |
| `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Modify | Cobertura de rollback restore, no estado parcial, y session meta retenida. |
| `hato-fe/src/app/core/offline/backup/*.spec.ts` | Create | Tests unitarios de contrato/validator/import pipeline. |
| `hato-be/*` | No-op (V1) | Sin cambios funcionales; el gate de sync existente ya bloquea por `reauth_required`. |

## Interfaces / Contracts

```ts
export interface BackupEnvelopeV1 {
  backupVersion: '1.0.0';
  createdAt: string;
  sourceSchemaVersion: number;
  manifest: { imagesExcluded: boolean; entityCounts: Record<string, number> };
  offlineState: PersistedOfflineState;
  images?: Array<{ operationId: string; mimeType: string; sizeBytes: number; base64: string }>;
  integrity: { imageOperationIds: string[]; digest?: string };
}
```

Reglas clave:
- `backupVersion` MUST ser `1.0.0` en V1.
- `sourceSchemaVersion` MUST ser compatible con `migrateOfflineState`.
- Si `imagesExcluded=true`, `images` SHALL omitirse.
- Toda referencia de imagen MUST existir y mapear a `operationId` válido.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Contrato/validator/integridad | Casos válidos + corruptos + incompatibilidad de versión |
| Unit | Restore transaccional | Simular falla intermedia y verificar rollback completo |
| Integration (FE) | Rehidratación ordenada | Import exitoso dispara rebuild de stores y eventos runtime |
| Integration (FE) | Seguridad de sesión | Tras restore/import queda `reauth_required`; sync bloqueado |
| BE regression | Sync gate | Mantener tests existentes de bloqueo para sesión no activa |

## Migration / Rollout

Rollout con feature flag FE (`offlineBackupV1Enabled`) y UI sólo ADMIN. Sin migración backend. Fallback: desactivar import/restore y mantener export diagnóstico.

## Open Questions

- [ ] Definir límite duro de tamaño para export con imágenes (MB) y mensaje UX.
- [ ] Confirmar si `digest` criptográfico se implementa en V1 o queda opcional informativo.
