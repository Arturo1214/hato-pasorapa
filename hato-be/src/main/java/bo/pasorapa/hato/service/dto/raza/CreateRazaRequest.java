package bo.pasorapa.hato.service.dto.raza;

import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateRazaRequest(
        @NotBlank @Size(max = 120) String nombre,
        @Size(max = 500) String descripcion,
        @Size(max = 120) String origen,
        Integer sortOrder,
        RazaTipo tipo) {

    public CreateRazaRequest(String nombre, String descripcion, String origen, Integer sortOrder) {
        this(nombre, descripcion, origen, sortOrder, RazaTipo.UNCLASSIFIED);
    }
}
