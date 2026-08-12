package bo.pasorapa.hato.service.dto.raza;

import io.quarkus.runtime.annotations.RegisterForReflection;
import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RegisterForReflection
public record UpdateRazaRequest(
        @NotBlank @Size(max = 120) String nombre,
        @Size(max = 500) String descripcion,
        @Size(max = 120) String origen,
        @NotNull Boolean activo,
        Integer sortOrder,
        RazaTipo tipo) {

    public UpdateRazaRequest(String nombre, String descripcion, String origen, Boolean activo, Integer sortOrder) {
        this(nombre, descripcion, origen, activo, sortOrder, RazaTipo.UNCLASSIFIED);
    }
}