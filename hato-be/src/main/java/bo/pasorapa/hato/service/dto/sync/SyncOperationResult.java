package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.UUID;

@RegisterForReflection
public record SyncOperationResult(
        UUID operationId,
        SyncEntityType entityType,
        String entityId,
        String classification,
        Integer serverVersion,
        SyncConflictResponse conflict
) {
}
