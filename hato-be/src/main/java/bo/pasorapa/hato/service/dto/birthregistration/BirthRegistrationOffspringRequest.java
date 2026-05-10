package bo.pasorapa.hato.service.dto.birthregistration;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record BirthRegistrationOffspringRequest(
        String arete,
        String marca,
        String tatuaje,
        @NotNull AnimalCategory category,
        @NotNull AnimalSex sex,
        @NotNull Boolean active,
        LocalDate admissionDate,
        @DecimalMin("0.00") BigDecimal weightKg
) {
}
