package bo.pasorapa.hato.service.dto.admin.auth;

public record AuthLoginResponse(
        String accessToken,
        String tokenType,
        long expiresInSeconds,
        AuthUserResponse user
) {
}
