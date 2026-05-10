package bo.pasorapa.hato.service.dto.publicapi.ganadero;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record PublicUserDto(
        String id,
        String ganaderoId,
        String username,
        String email,
        String displayName,
        String role,
        String status
) {
}
