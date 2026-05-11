package bo.pasorapa.hato.service.dto.raza;

import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import java.time.LocalDateTime;
import java.util.UUID;

public record RazaResponse(
        UUID uuid,
        String nombre,
        String descripcion,
        String origen,
        RazaTipo tipo,
        Boolean activo,
        Integer sortOrder,
        Long version,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
