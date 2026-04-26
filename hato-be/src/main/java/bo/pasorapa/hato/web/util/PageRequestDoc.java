package bo.pasorapa.hato.web.util;

import jakarta.ws.rs.QueryParam;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;

public class PageRequestDoc {

    @QueryParam("page")
    @Parameter(description = "Número de página basado en 0")
    String page;

    @QueryParam("size")
    @Parameter(description = "Tamaño de página")
    String size;

    @QueryParam("sort")
    @Parameter(description = "Ordenamiento repetible: sort=campo,asc o sort=campo,desc")
    String sort;
}

