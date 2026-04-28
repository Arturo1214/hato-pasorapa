package bo.pasorapa.hato.service.dto.animalhealthevent;

import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AnimalHealthEventResponse(
        UUID id,
        UUID animalUuid,
        AnimalHealthEventType healthEventType,
        OffsetDateTime occurredAt,
        String notes,
        UUID performedByUserId,
        String sourceChannel,
        UUID operationId,
        Map<String, Object> metadata,
        String visitId,
        String followUpStatus,
        OffsetDateTime nextDueAt,
        OffsetDateTime clientCreatedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
