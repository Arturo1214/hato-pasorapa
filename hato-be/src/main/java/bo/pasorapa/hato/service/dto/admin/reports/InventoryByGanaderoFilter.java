package bo.pasorapa.hato.service.dto.admin.reports;

import jakarta.ws.rs.QueryParam;
import java.util.UUID;

public class InventoryByGanaderoFilter {
    @QueryParam("ganaderoId")
    public UUID ganaderoId;

    @QueryParam("active")
    public Boolean active;
}
