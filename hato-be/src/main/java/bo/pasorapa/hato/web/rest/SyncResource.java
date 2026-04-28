package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.SyncService;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.ResolveConflictRequest;
import bo.pasorapa.hato.service.dto.sync.ResolveConflictResponse;
import bo.pasorapa.hato.service.dto.sync.SyncConflictListItemResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncObservabilityResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/sync")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class SyncResource {

    private static final String CONFLICT_VERSION_HEADER = "X-Sync-Conflict-Version";

    private final SyncService syncService;
    private final JsonWebToken jsonWebToken;

    public SyncResource(SyncService syncService, JsonWebToken jsonWebToken) {
        this.syncService = syncService;
        this.jsonWebToken = jsonWebToken;
    }

    @POST
    @Path("/push")
    public Response push(@Valid PushSyncRequest request, @HeaderParam(CONFLICT_VERSION_HEADER) String conflictVersionHeader) {
        PushSyncResponse response = syncService.push(request, currentUserId(), isConflictResolutionV2Enabled(conflictVersionHeader));
        Response.Status status = response.hasConflicts() ? Response.Status.CONFLICT : Response.Status.OK;
        return Response.status(status).entity(response).build();
    }

    @GET
    @Path("/pull")
    public PullSyncResponse pull(
            @QueryParam("entityType") SyncEntityType entityType,
            @QueryParam("cursorUpdatedAt") OffsetDateTime cursorUpdatedAt,
            @QueryParam("cursorId") String cursorId) {
        return syncService.pull(entityType, cursorUpdatedAt, cursorId, currentUserId());
    }

    @GET
    @Path("/conflicts")
    public List<SyncConflictListItemResponse> listConflicts(
            @HeaderParam(CONFLICT_VERSION_HEADER) String conflictVersionHeader,
            @QueryParam("operationId") String operationId) {
        requireConflictResolutionV2(conflictVersionHeader);
        UUID parsedOperationId = operationId == null || operationId.isBlank() ? null : UUID.fromString(operationId);
        return syncService.listConflicts(parsedOperationId);
    }

    @GET
    @Path("/observability")
    public SyncObservabilityResponse observability(@QueryParam("window") String window) {
        return syncService.getObservability(window);
    }

    @POST
    @Path("/conflicts/{operationId}/resolve")
    public ResolveConflictResponse resolveConflict(
            @HeaderParam(CONFLICT_VERSION_HEADER) String conflictVersionHeader,
            @PathParam("operationId") UUID operationId,
            @Valid ResolveConflictRequest request) {
        requireConflictResolutionV2(conflictVersionHeader);
        return syncService.resolveConflict(operationId, request, currentUserId());
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }

    private void requireConflictResolutionV2(String conflictVersionHeader) {
        if (!isConflictResolutionV2Enabled(conflictVersionHeader)) {
            throw new BusinessException(
                    "SYNC_CONFLICT_V2_HEADER_REQUIRED",
                    "El header X-Sync-Conflict-Version=2 es obligatorio para la resolución manual V2.",
                    Response.Status.PRECONDITION_FAILED);
        }
    }

    private boolean isConflictResolutionV2Enabled(String conflictVersionHeader) {
        return "2".equals(conflictVersionHeader);
    }
}
