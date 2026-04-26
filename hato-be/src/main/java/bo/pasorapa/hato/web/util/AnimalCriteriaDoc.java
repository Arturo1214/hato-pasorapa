package bo.pasorapa.hato.web.util;

import jakarta.ws.rs.QueryParam;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;

public class AnimalCriteriaDoc {

    @QueryParam("id.equals")
    @Parameter(description = "Filtra por id exacto")
    String idEquals;

    @QueryParam("id.greaterThan")
    @Parameter(description = "Filtra ids mayores a un valor")
    String idGreaterThan;

    @QueryParam("code.contains")
    @Parameter(description = "Filtra por coincidencia parcial en code")
    String codeContains;

    @QueryParam("tag.contains")
    @Parameter(description = "Filtra por coincidencia parcial en tag")
    String tagContains;

    @QueryParam("category.equals")
    @Parameter(description = "Filtra por categoría: COW, BULL, CALF, HEIFER")
    String categoryEquals;

    @QueryParam("active.equals")
    @Parameter(description = "Filtra por activo")
    String activeEquals;

    @QueryParam("admissionDate.greaterThanOrEqual")
    @Parameter(description = "Fecha mínima de ingreso en formato ISO yyyy-MM-dd")
    String admissionDateGreaterThanOrEqual;

    @QueryParam("admissionDate.lessThanOrEqual")
    @Parameter(description = "Fecha máxima de ingreso en formato ISO yyyy-MM-dd")
    String admissionDateLessThanOrEqual;
}

