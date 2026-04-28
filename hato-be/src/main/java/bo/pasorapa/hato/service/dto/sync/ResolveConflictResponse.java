package bo.pasorapa.hato.service.dto.sync;

import java.util.UUID;

public record ResolveConflictResponse(
        UUID operationId,
        String status,
        String resultVersion,
        String nextLocalStatus,
        String entityId,
        Integer serverVersion,
        Object serverState
) {
}
