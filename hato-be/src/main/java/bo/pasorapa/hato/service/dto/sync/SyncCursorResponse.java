package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.time.OffsetDateTime;

@RegisterForReflection
public record SyncCursorResponse(
        SyncEntityType entityType,
        OffsetDateTime cursorUpdatedAt,
        String cursorId,
        OffsetDateTime lastSuccessAt
) {
}
