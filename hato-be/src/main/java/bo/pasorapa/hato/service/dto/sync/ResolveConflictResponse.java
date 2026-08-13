package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.UUID;

@RegisterForReflection
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
