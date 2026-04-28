package bo.pasorapa.hato.service.dto.animalevent;

import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AnimalEventResponse(
        UUID id,
        UUID animalUuid,
        AnimalEventType type,
        OffsetDateTime occurredAt,
        String notes,
        UUID performedByUserId,
        String sourceChannel,
        UUID operationId,
        Map<String, Object> metadata,
        OffsetDateTime clientCreatedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
