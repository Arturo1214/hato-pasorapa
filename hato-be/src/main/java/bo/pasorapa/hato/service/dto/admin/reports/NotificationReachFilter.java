package bo.pasorapa.hato.service.dto.admin.reports;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.QueryParam;
import java.time.LocalDate;

public class NotificationReachFilter {
    @QueryParam("from")
    @PastOrPresent
    public LocalDate from;

    @QueryParam("to")
    @PastOrPresent
    public LocalDate to;

    @QueryParam("limit")
    @DefaultValue("200")
    @Min(1)
    @Max(500)
    public int limit = 200;
}
