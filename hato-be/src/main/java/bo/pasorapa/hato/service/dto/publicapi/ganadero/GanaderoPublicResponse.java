package bo.pasorapa.hato.service.dto.publicapi.ganadero;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record GanaderoPublicResponse(
        String accessToken,
        String tokenType,
        long expiresInSeconds,
        PublicUserDto user
) {
}
