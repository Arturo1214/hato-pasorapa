package bo.pasorapa.hato.service.dto.admin.users;

public record AdminUserResponse(
        String id,
        String username,
        String email,
        String displayName,
        String role,
        String status,
        long version,
        String createdAt,
        String updatedAt,
        String lastSyncedAt
) {
}
