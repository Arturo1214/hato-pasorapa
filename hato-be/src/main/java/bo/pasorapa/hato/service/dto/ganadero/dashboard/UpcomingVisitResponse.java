package bo.pasorapa.hato.service.dto.ganadero.dashboard;

import java.time.LocalDate;
import java.util.UUID;

public record UpcomingVisitResponse(UUID id, String controlType, LocalDate plannedDate, String status) {
}
