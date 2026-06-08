package bo.pasorapa.hato.service.dto.vetvisit;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.QueryParam;
import java.time.OffsetDateTime;
import java.util.UUID;

public class VetVisitFilterDto {

    @QueryParam("mode")
    public String mode;

    @QueryParam("status")
    public String status;

    @QueryParam("animalUuid")
    public UUID animalUuid;

    @QueryParam("visitId")
    public String visitId;

    @QueryParam("occurredFrom")
    public OffsetDateTime occurredFrom;

    @QueryParam("occurredTo")
    public OffsetDateTime occurredTo;

    @QueryParam("page")
    @DefaultValue("0")
    @Min(0)
    public int page;

    @QueryParam("size")
    @DefaultValue("20")
    @Min(1)
    @Max(100)
    public int size;

    public int offset() {
        return page * size;
    }

    public String normalizedMode() {
        return normalize(mode);
    }

    public String normalizedStatus() {
        return VetVisitStatusNormalizer.canonicalize(status);
    }

    public String normalizedVisitId() {
        return normalize(visitId);
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
