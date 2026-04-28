package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.service.AnimalEventService;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventListResponse;
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

@Path("/api/animals/{uuid}/events")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalEventResource {

    private final AnimalEventService animalEventService;

    public AnimalEventResource(AnimalEventService animalEventService) {
        this.animalEventService = animalEventService;
    }

    @GET
    public AnimalEventListResponse list(
            @PathParam("uuid") UUID animalUuid,
            @QueryParam("eventType") AnimalEventType eventType,
            @QueryParam("occurredFrom") OffsetDateTime occurredFrom,
            @QueryParam("occurredTo") OffsetDateTime occurredTo) {
        return new AnimalEventListResponse(animalEventService.list(animalUuid, eventType, occurredFrom, occurredTo));
    }
}
