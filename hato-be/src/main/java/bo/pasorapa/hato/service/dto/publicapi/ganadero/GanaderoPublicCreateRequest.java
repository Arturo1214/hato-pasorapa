package bo.pasorapa.hato.service.dto.publicapi.ganadero;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@RegisterForReflection
public record GanaderoPublicCreateRequest(
        @NotBlank String businessIdentifier,
        @NotBlank String name,
        @NotBlank @Email String email,
        @NotBlank String password,
        String website,
        @NotNull Instant formIssuedAt
) {
}
