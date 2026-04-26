package bo.pasorapa.hato.service.dto.admin.auth;

public record AuthUserResponse(
        String id,
        String username,
        String email,
        String displayName,
        String role,
        String status,
        long version,
        String updatedAt,
        String lastSyncedAt
) {
}
