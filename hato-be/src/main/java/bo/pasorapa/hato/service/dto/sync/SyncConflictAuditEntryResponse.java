package bo.pasorapa.hato.service.dto.sync;

public record SyncConflictAuditEntryResponse(
        String eventType,
        String decision,
        String resultStatus,
        String reason,
        String actorUserId,
        String createdAt
) {
}
