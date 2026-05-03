package bo.pasorapa.hato.service.dto.admin.auth;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record AuthLoginResponse(
        String accessToken,
        String tokenType,
        long expiresInSeconds,
        AuthUserResponse user
) {
}
