package bo.pasorapa.hato.service.dto.animalreproductionevent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ReproductiveServiceEventRequest(
        @NotNull OffsetDateTime occurredAt,
        @NotBlank String serviceMethod,
        UUID fatherAnimalUuid,
        String semenReference,
        String bullReference,
        String notes,
        UUID operationId,
        OffsetDateTime clientCreatedAt
) {
}
