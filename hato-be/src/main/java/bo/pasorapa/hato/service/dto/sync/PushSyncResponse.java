package bo.pasorapa.hato.service.dto.sync;

import java.util.List;

public record PushSyncResponse(
        List<SyncOperationResult> results
) {

    public boolean hasConflicts() {
        return results.stream().anyMatch(result -> "version_conflict".equals(result.classification()));
    }
}
