package bo.pasorapa.hato.service.dto.animalevent;

import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AnimalEventRequest(
        @NotNull UUID animalUuid,
        @NotNull AnimalEventType type,
        @NotNull OffsetDateTime occurredAt,
        @Size(max = 500) String notes,
        UUID performedByUserId,
        @NotBlank String sourceChannel,
        @NotNull UUID operationId,
        @NotNull Map<String, Object> metadata,
        @NotNull OffsetDateTime clientCreatedAt
) {
}
