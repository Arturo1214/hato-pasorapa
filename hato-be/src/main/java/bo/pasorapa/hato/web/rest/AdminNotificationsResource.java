package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AdminNotificationService;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationCreateRequest;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationListResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/admin/notifications")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class AdminNotificationsResource {

    private final AdminNotificationService adminNotificationService;
    private final JsonWebToken jsonWebToken;

    public AdminNotificationsResource(AdminNotificationService adminNotificationService, JsonWebToken jsonWebToken) {
        this.adminNotificationService = adminNotificationService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public AdminNotificationListResponse list() {
        return adminNotificationService.listIssuedNotifications();
    }

    @POST
    public Response create(@Valid AdminNotificationCreateRequest request, @HeaderParam("X-Operation-Id") String operationIdHeader) {
        MutationResult<AdminNotificationResponse> result = adminNotificationService.create(
                request,
                requireOperationId(operationIdHeader),
                currentUserId());
        return Response.status(result.replayed() ? Response.Status.OK : Response.Status.CREATED).entity(result.data()).build();
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
