package bo.pasorapa.hato.service.dto.raza;

import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
