package bo.pasorapa.hato.service.dto.sync;

import java.util.List;
import java.util.UUID;

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
