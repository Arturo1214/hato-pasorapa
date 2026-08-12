package bo.pasorapa.hato.service.dto.raza;

import io.quarkus.runtime.annotations.RegisterForReflection;
import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import java.util.UUID;

@RegisterForReflection
public record RazaOptionResponse(UUID uuid, String nombre, String origen, RazaTipo tipo, Integer sortOrder) {}