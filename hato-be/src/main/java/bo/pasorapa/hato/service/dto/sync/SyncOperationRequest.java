package bo.pasorapa.hato.service.dto.sync;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record SyncOperationRequest(
        @NotNull UUID operationId,
        @NotNull SyncEntityType entityType,
        @NotBlank String entityId,
        @NotNull SyncOperationType opType,
        @NotNull Map<String, Object> payload,
        @NotNull @PositiveOrZero Integer baseVersion,
        @NotNull OffsetDateTime clientCreatedAt,
        @NotNull OffsetDateTime clientUpdatedAt
) {
}
