package bo.pasorapa.hato.service.dto.animalreproductionevent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PregnancyDiagnosisEventRequest(
        @NotNull OffsetDateTime diagnosisDate,
        @NotBlank String result,
        OffsetDateTime expectedBirthDate,
        UUID serviceEventUuid,
        UUID relatedServiceEventId,
        String notes,
        UUID operationId,
        OffsetDateTime clientCreatedAt
) {
}
