package bo.pasorapa.hato.service.dto.ganadero.dashboard;

import java.time.LocalDate;
import java.util.UUID;

public record UpcomingEventResponse(UUID id, String eventType, LocalDate eventDate, String description) {
}
