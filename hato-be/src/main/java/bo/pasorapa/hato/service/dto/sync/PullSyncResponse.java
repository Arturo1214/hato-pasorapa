package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;
import java.util.Map;

@RegisterForReflection
public record PullSyncResponse(
        SyncEntityType entityType,
        List<Map<String, Object>> items,
        SyncCursorResponse nextCursor,
        boolean hasMore
) {
}
