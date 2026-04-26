package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.SyncService;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;

@Path("/api/sync")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class SyncResource {

    private final SyncService syncService;

    public SyncResource(SyncService syncService) {
        this.syncService = syncService;
    }

    @POST
    @Path("/push")
    public Response push(@Valid PushSyncRequest request) {
        PushSyncResponse response = syncService.push(request);
        Response.Status status = response.hasConflicts() ? Response.Status.CONFLICT : Response.Status.OK;
        return Response.status(status).entity(response).build();
    }

    @GET
    @Path("/pull")
    public PullSyncResponse pull(
            @QueryParam("entityType") SyncEntityType entityType,
            @QueryParam("cursorUpdatedAt") OffsetDateTime cursorUpdatedAt,
            @QueryParam("cursorId") String cursorId) {
        return syncService.pull(entityType, cursorUpdatedAt, cursorId);
    }
}
