package bo.pasorapa.hato.service.dto.admin.auth;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record AuthUserResponse(
        String id,
        String ganaderoId,
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
