package bo.pasorapa.hato.service.dto.raza;

import io.quarkus.runtime.annotations.RegisterForReflection;
import java.util.List;

@RegisterForReflection
public record RazaListResponse<T>(List<T> items) {}