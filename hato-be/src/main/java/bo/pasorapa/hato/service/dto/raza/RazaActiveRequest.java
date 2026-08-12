package bo.pasorapa.hato.service.dto.raza;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotNull;

@RegisterForReflection
public record RazaActiveRequest(@NotNull Boolean activo) {}