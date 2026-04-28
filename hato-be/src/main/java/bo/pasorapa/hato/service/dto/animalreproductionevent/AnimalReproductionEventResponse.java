package bo.pasorapa.hato.service.dto.animalreproductionevent;

import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AnimalReproductionEventResponse(
        UUID id,
        UUID animalUuid,
        AnimalReproductionEventType reproductionEventType,
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
