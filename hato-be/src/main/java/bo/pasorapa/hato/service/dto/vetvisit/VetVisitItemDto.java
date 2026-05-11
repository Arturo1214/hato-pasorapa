package bo.pasorapa.hato.service.dto.vetvisit;

import java.time.OffsetDateTime;
import java.util.UUID;

public record VetVisitItemDto(
        String visitId,
        String mode,
        String status,
        VeterinarianDto veterinarian,
        OffsetDateTime occurredAt,
        OffsetDateTime nextControlAt,
        UUID animalUuid,
        Integer targetAnimalCount,
        String atencionNotas) {

    public record VeterinarianDto(String name, String license) {
    }
}
