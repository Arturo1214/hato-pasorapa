package bo.pasorapa.hato.service.dto.birthregistration;

import bo.pasorapa.hato.service.dto.AnimalResponse;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record BirthRegistrationResponse(
        UUID eventId,
        UUID motherAnimalUuid,
        UUID fatherAnimalUuid,
        LocalDate birthDate,
        int offspringCount,
        List<AnimalResponse> offspring
) {
}
