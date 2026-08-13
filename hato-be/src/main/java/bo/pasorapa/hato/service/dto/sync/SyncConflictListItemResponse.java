package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;
import java.util.UUID;

@RegisterForReflection
public record SyncConflictListItemResponse(
        UUID operationId,
        SyncEntityType entityType,
        String entityId,
        SyncOperationType opType,
        String classification,
        SyncConflictResponse conflict,
        List<SyncConflictAuditEntryResponse> auditTrail
) {
}
