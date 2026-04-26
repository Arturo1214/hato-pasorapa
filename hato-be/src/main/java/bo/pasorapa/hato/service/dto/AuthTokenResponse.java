package bo.pasorapa.hato.service.dto;

public record AuthTokenResponse(String token, String tokenType, long expiresInSeconds) {
}

