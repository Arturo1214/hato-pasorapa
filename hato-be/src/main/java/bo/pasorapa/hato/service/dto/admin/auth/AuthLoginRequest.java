package bo.pasorapa.hato.service.dto.admin.auth;

import jakarta.validation.constraints.NotBlank;

public record AuthLoginRequest(
        @NotBlank String username,
        @NotBlank String password
) {
}
