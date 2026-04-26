package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.GanaderoService;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoCreateRequest;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoResponse;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoStatusUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderosListResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/admin/ganaderos")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class GanaderosResource {

    private final GanaderoService ganaderoService;
    private final JsonWebToken jsonWebToken;

    public GanaderosResource(GanaderoService ganaderoService, JsonWebToken jsonWebToken) {
        this.ganaderoService = ganaderoService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public GanaderosListResponse list(@QueryParam("active") Boolean active) {
        return ganaderoService.list(active);
    }

    @POST
    public Response create(@Valid GanaderoCreateRequest request, @HeaderParam("X-Operation-Id") String operationIdHeader) {
        MutationResult<GanaderoResponse> result = ganaderoService.create(request, requireOperationId(operationIdHeader), currentUserId());
        return Response.status(result.replayed() ? Response.Status.OK : Response.Status.CREATED).entity(result.data()).build();
    }

    @PUT
    @Path("/{id}/status")
    public GanaderoResponse updateStatus(
            @PathParam("id") UUID id,
            @Valid GanaderoStatusUpdateRequest request,
            @HeaderParam("X-Operation-Id") String operationIdHeader) {
        return ganaderoService.updateStatus(id, request, requireOperationId(operationIdHeader), currentUserId()).data();
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }

    private UUID requireOperationId(String operationIdHeader) {
        if (operationIdHeader == null || operationIdHeader.isBlank()) {
            throw new BusinessException("OPERATION_ID_REQUIRED", "El header X-Operation-Id es obligatorio.", Response.Status.BAD_REQUEST);
        }

        try {
            return UUID.fromString(operationIdHeader);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("INVALID_OPERATION_ID", "El header X-Operation-Id debe ser un UUID válido.", Response.Status.BAD_REQUEST);
        }
    }
}
