package bo.pasorapa.hato.service.dto.admin.ganadero;

import jakarta.validation.constraints.NotBlank;

public record GanaderoCreateRequest(
        @NotBlank String businessIdentifier,
        @NotBlank String name
) {
}
