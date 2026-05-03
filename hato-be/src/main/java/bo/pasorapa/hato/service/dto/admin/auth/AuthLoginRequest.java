package bo.pasorapa.hato.service.dto.admin.auth;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;

@RegisterForReflection
public record AuthLoginRequest(
        @NotBlank String username,
        @NotBlank String password
) {
}
