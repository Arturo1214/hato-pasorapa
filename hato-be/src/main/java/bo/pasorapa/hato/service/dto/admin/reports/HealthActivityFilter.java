package bo.pasorapa.hato.service.dto.admin.reports;

import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.QueryParam;
import java.time.LocalDate;
import java.util.UUID;

public class HealthActivityFilter {
    @QueryParam("from")
    @NotNull
    @PastOrPresent
    public LocalDate from;

    @QueryParam("to")
    @NotNull
    @PastOrPresent
    public LocalDate to;

    @QueryParam("type")
    public AnimalHealthEventType type;

    @QueryParam("ganaderoId")
    public UUID ganaderoId;

    @QueryParam("animalUuid")
    public UUID animalUuid;

    @QueryParam("limit")
    @DefaultValue("200")
    @Min(1)
    @Max(500)
    public int limit = 200;
}
