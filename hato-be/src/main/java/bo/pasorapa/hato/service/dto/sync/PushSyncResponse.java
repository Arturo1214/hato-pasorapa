package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

@RegisterForReflection
public record PushSyncResponse(
        List<SyncOperationResult> results
) {

    public boolean hasConflicts() {
        return results.stream().anyMatch(result -> "version_conflict".equals(result.classification()));
    }
}
