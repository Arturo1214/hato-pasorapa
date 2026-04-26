package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.service.AdminUserService;
import bo.pasorapa.hato.service.dto.admin.common.ActionMessageResponse;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserCreateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserPasswordUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserResponse;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserStatusUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUsersListResponse;
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

@Path("/api/admin/users")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class AdminUsersResource {

    private final AdminUserService adminUserService;
    private final JsonWebToken jsonWebToken;

    public AdminUsersResource(AdminUserService adminUserService, JsonWebToken jsonWebToken) {
        this.adminUserService = adminUserService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public AdminUsersListResponse list(@QueryParam("status") UserStatus status) {
        return adminUserService.list(status);
    }

    @POST
    public Response create(@Valid AdminUserCreateRequest request, @HeaderParam("X-Operation-Id") String operationIdHeader) {
        MutationResult<AdminUserResponse> result = adminUserService.create(request, requireOperationId(operationIdHeader), currentUserId());
        return Response.status(result.replayed() ? Response.Status.OK : Response.Status.CREATED).entity(result.data()).build();
    }

    @PUT
    @Path("/{id}/status")
    public AdminUserResponse updateStatus(
            @PathParam("id") UUID id,
            @Valid AdminUserStatusUpdateRequest request,
            @HeaderParam("X-Operation-Id") String operationIdHeader) {
        return adminUserService.updateStatus(id, request, requireOperationId(operationIdHeader), currentUserId()).data();
    }

    @PUT
    @Path("/{id}/password")
    public ActionMessageResponse updatePassword(
            @PathParam("id") UUID id,
            @Valid AdminUserPasswordUpdateRequest request,
            @HeaderParam("X-Operation-Id") String operationIdHeader) {
        return adminUserService.updatePassword(id, request, requireOperationId(operationIdHeader), currentUserId()).data();
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
