package bo.pasorapa.hato.service.dto.sync;

import java.util.UUID;

public record SyncOperationResult(
        UUID operationId,
        SyncEntityType entityType,
        String entityId,
        String classification,
        Integer serverVersion,
        SyncConflictResponse conflict
) {
}
