package bo.pasorapa.hato.service.dto;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record AnimalResponse(
        Long id,
        UUID uuid,
        String code,
        String tag,
        AnimalCategory category,
        Boolean active,
        LocalDate admissionDate,
        BigDecimal weightKg,
        LocalDateTime createdAt,
        Long version,
        LocalDateTime updatedAt,
        LocalDateTime lastSyncedAt
) {
}
