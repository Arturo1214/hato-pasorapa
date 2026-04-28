package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.service.AnimalReproductionEventService;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventListResponse;
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

@Path("/api/animals/{uuid}/reproduction-events")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalReproductionEventResource {

    private final AnimalReproductionEventService animalReproductionEventService;

    public AnimalReproductionEventResource(AnimalReproductionEventService animalReproductionEventService) {
        this.animalReproductionEventService = animalReproductionEventService;
    }

    @GET
    public AnimalReproductionEventListResponse list(
            @PathParam("uuid") UUID animalUuid,
            @QueryParam("reproductionEventType") AnimalReproductionEventType reproductionEventType,
            @QueryParam("occurredFrom") OffsetDateTime occurredFrom,
            @QueryParam("occurredTo") OffsetDateTime occurredTo) {
        return new AnimalReproductionEventListResponse(
                animalReproductionEventService.list(animalUuid, reproductionEventType, occurredFrom, occurredTo));
    }
}
