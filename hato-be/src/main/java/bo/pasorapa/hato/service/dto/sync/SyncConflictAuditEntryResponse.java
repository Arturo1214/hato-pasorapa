package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record SyncConflictAuditEntryResponse(
        String eventType,
        String decision,
        String resultStatus,
        String reason,
        String actorUserId,
        String createdAt
) {
}
