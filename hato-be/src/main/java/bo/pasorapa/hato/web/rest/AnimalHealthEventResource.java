package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.service.AnimalHealthEventService;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventListResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/animals/{uuid}/health-events")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalHealthEventResource {

    private final AnimalHealthEventService animalHealthEventService;
    private final JsonWebToken jsonWebToken;

    public AnimalHealthEventResource(AnimalHealthEventService animalHealthEventService, JsonWebToken jsonWebToken) {
        this.animalHealthEventService = animalHealthEventService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public AnimalHealthEventListResponse list(
            @PathParam("uuid") UUID animalUuid,
            @QueryParam("healthEventType") AnimalHealthEventType healthEventType,
            @QueryParam("occurredFrom") OffsetDateTime occurredFrom,
            @QueryParam("occurredTo") OffsetDateTime occurredTo,
            @QueryParam("visitId") String visitId) {
        return new AnimalHealthEventListResponse(animalHealthEventService.list(
                animalUuid,
                healthEventType,
                occurredFrom,
                occurredTo,
                visitId,
                currentUserId(),
                jsonWebToken.getGroups().contains("GANADERO")));
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}
