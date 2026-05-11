package bo.pasorapa.hato.service.dto.vetvisit;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
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
        String atencionNotas,
        BigDecimal costo,
        String costCurrency,
        List<String> treatmentPlan) {

    public record VeterinarianDto(String name, String license) {
    }
}
