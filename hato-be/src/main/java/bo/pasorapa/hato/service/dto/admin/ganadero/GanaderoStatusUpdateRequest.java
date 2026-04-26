package bo.pasorapa.hato.service.dto.admin.ganadero;

import jakarta.validation.constraints.NotNull;

public record GanaderoStatusUpdateRequest(@NotNull Boolean active) {
}
