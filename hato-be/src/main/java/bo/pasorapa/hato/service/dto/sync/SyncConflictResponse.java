package bo.pasorapa.hato.service.dto.sync;

public record SyncConflictResponse(
        String entityId,
        Integer clientVersion,
        Integer serverVersion,
        String reason,
        String resolutionHint,
        Object serverState
) {
}
