package bo.pasorapa.hato.service.dto;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record AnimalResponse(
        UUID uuid,
        UUID ownerGanaderoId,
        UUID motherAnimalUuid,
        UUID fatherAnimalUuid,
        String arete,
        String marca,
        String tatuaje,
        AnimalCategory category,
        Boolean active,
        LocalDate birthDate,
        LocalDate admissionDate,
        BigDecimal weightKg,
        LocalDateTime createdAt,
        Long version,
        LocalDateTime updatedAt,
        LocalDateTime lastSyncedAt
) {
}
