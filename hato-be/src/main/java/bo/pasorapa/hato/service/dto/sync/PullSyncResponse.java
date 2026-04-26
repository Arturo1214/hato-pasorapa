package bo.pasorapa.hato.service.dto.sync;

import java.util.List;
import java.util.Map;

public record PullSyncResponse(
        SyncEntityType entityType,
        List<Map<String, Object>> items,
        SyncCursorResponse nextCursor,
        boolean hasMore
) {
}
