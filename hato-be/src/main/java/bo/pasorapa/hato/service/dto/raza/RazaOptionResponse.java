package bo.pasorapa.hato.service.dto.raza;

import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import java.util.UUID;

public record RazaOptionResponse(UUID uuid, String nombre, String origen, RazaTipo tipo, Integer sortOrder) {}
