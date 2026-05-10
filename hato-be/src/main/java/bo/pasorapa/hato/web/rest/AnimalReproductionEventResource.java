package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.service.AnimalReproductionEventService;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventListResponse;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.PregnancyDiagnosisEventRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.ReproductiveServiceEventRequest;
import bo.pasorapa.hato.service.mapper.AnimalReproductionEventMapper;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/animals/{uuid}/reproduction-events")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalReproductionEventResource {

    private final AnimalReproductionEventService animalReproductionEventService;
    private final AnimalReproductionEventMapper animalReproductionEventMapper;
    private final JsonWebToken jsonWebToken;

    public AnimalReproductionEventResource(
            AnimalReproductionEventService animalReproductionEventService,
            AnimalReproductionEventMapper animalReproductionEventMapper,
            JsonWebToken jsonWebToken) {
        this.animalReproductionEventService = animalReproductionEventService;
        this.animalReproductionEventMapper = animalReproductionEventMapper;
        this.jsonWebToken = jsonWebToken;
    }

    @POST
    public Response createService(
            @PathParam("uuid") UUID animalUuid,
            @Valid ReproductiveServiceEventRequest request,
            @Context UriInfo uriInfo) {
        UUID currentUserId = currentUserId();
        var event = animalReproductionEventService.create(new AnimalReproductionEventRequest(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                request.occurredAt(),
                request.notes(),
                currentUserId,
                "ONLINE",
                request.operationId() == null ? UUID.randomUUID() : request.operationId(),
                serviceMetadata(request),
                request.clientCreatedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : request.clientCreatedAt()), currentUserId);

        var response = animalReproductionEventMapper.toResponse(event);
        return Response.created(uriInfo.getAbsolutePathBuilder().path(String.valueOf(response.id())).build())
                .entity(response)
                .build();
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

    @POST
    @Path("pregnancy-diagnosis")
    public Response createPregnancyDiagnosis(
            @PathParam("uuid") UUID animalUuid,
            @Valid PregnancyDiagnosisEventRequest request,
            @Context UriInfo uriInfo) {
        UUID currentUserId = currentUserId();
        var event = animalReproductionEventService.create(new AnimalReproductionEventRequest(
                animalUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                request.diagnosisDate(),
                request.notes(),
                currentUserId,
                "ONLINE",
                request.operationId() == null ? UUID.randomUUID() : request.operationId(),
                pregnancyDiagnosisMetadata(request),
                request.clientCreatedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : request.clientCreatedAt()), currentUserId);

        var response = animalReproductionEventMapper.toResponse(event);
        return Response.created(uriInfo.getAbsolutePathBuilder().path(String.valueOf(response.id())).build())
                .entity(response)
                .build();
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }

    private Map<String, Object> serviceMetadata(ReproductiveServiceEventRequest request) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("serviceMethod", request.serviceMethod());
        if (request.fatherAnimalUuid() != null) {
            metadata.put("fatherAnimalUuid", request.fatherAnimalUuid().toString());
        }
        putIfPresent(metadata, "semenReference", request.semenReference());
        putIfPresent(metadata, "bullReference", request.bullReference());
        return metadata;
    }

    private Map<String, Object> pregnancyDiagnosisMetadata(PregnancyDiagnosisEventRequest request) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("diagnosisDate", request.diagnosisDate().toString());
        metadata.put("result", request.result());
        if (request.expectedBirthDate() != null) {
            metadata.put("expectedBirthDate", request.expectedBirthDate().toString());
        }
        UUID serviceEventUuid = request.serviceEventUuid() != null ? request.serviceEventUuid() : request.relatedServiceEventId();
        if (serviceEventUuid != null) {
            metadata.put("serviceEventUuid", serviceEventUuid.toString());
        }
        if ("NO_PRENADA".equals(request.result())) {
            metadata.put("negativeResult", true);
            metadata.put("status", "fallo");
        }
        return metadata;
    }

    private void putIfPresent(Map<String, Object> metadata, String key, String value) {
        if (value != null && !value.isBlank()) {
            metadata.put(key, value.trim());
        }
    }
}
