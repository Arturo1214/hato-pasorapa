package bo.pasorapa.hato.service.dto.admin.profile;

import jakarta.validation.constraints.NotBlank;

public record ProfileUpdateRequest(
        @NotBlank String telefono,
        @NotBlank String direccion
) {
}
