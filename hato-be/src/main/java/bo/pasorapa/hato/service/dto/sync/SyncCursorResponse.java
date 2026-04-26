package bo.pasorapa.hato.service.dto.sync;

import java.time.OffsetDateTime;

public record SyncCursorResponse(
        SyncEntityType entityType,
        OffsetDateTime cursorUpdatedAt,
        String cursorId,
        OffsetDateTime lastSuccessAt
) {
}
