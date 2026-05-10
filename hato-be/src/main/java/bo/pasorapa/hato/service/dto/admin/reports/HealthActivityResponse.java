package bo.pasorapa.hato.service.dto.admin.reports;

import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record HealthActivityResponse(List<HealthActivityRow> rows) {
    public record HealthActivityRow(
            UUID eventId,
            LocalDateTime occurredAt,
            AnimalHealthEventType type,
            UUID ganaderoId,
            String ganaderoName,
            UUID animalUuid,
            String animalCode,
            String animalTag,
            String notes) {}
}
