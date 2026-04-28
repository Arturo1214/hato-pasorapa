package bo.pasorapa.hato.service.dto;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AnimalRequest(
        @NotNull UUID ownerGanaderoId,
        String arete,
        String marca,
        String tatuaje,
        @NotNull AnimalCategory category,
        @NotNull Boolean active,
        @NotNull LocalDate admissionDate,
        @DecimalMin("0.00") BigDecimal weightKg
) {
}
