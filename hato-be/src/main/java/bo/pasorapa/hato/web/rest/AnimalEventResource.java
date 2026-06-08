package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.service.AnimalEventService;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventListResponse;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/animals/{uuid}/events")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalEventResource {

    private final AnimalEventService animalEventService;
    private final JsonWebToken jsonWebToken;

    public AnimalEventResource(AnimalEventService animalEventService, JsonWebToken jsonWebToken) {
        this.animalEventService = animalEventService;
        this.jsonWebToken = jsonWebToken;
    }

    @POST
    @RolesAllowed("ADMIN")
    public Response create(
            @PathParam("uuid") UUID animalUuid,
            AnimalEventRequest request,
            @HeaderParam("X-Operation-Id") UUID operationIdHeader) {
        AnimalEventRequest normalizedRequest = new AnimalEventRequest(
                animalUuid,
                request.type(),
                request.occurredAt(),
                request.notes(),
                currentUserId(),
                request.sourceChannel(),
                operationIdHeader != null ? operationIdHeader : request.operationId(),
                request.metadata(),
                request.clientCreatedAt());

        var result = animalEventService.create(normalizedRequest, currentUserId());
        return Response.status(Response.Status.CREATED).entity(Map.of(
                "id", result.getEventId(),
                "animalUuid", result.getAnimal().getUuid(),
                "type", result.getType().name(),
                "category", result.getAnimal().getCategory().name())).build();
    }

    @GET
    public AnimalEventListResponse list(
            @PathParam("uuid") UUID animalUuid,
            @QueryParam("eventType") AnimalEventType eventType,
            @QueryParam("occurredFrom") OffsetDateTime occurredFrom,
            @QueryParam("occurredTo") OffsetDateTime occurredTo) {
        return new AnimalEventListResponse(animalEventService.list(animalUuid, eventType, occurredFrom, occurredTo, currentUserId()));
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}
