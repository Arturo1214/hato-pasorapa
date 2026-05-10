package bo.pasorapa.hato.service.dto.birthregistration;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record BirthRegistrationRequest(
        @NotNull LocalDate birthDate,
        UUID fatherAnimalUuid,
        @NotEmpty @Size(max = 5) List<@Valid BirthRegistrationOffspringRequest> offspring,
        String notes
) {
}
