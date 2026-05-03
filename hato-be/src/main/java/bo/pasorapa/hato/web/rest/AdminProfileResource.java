package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AdminProfileService;
import bo.pasorapa.hato.service.dto.admin.common.ActionMessageResponse;
import bo.pasorapa.hato.service.dto.admin.profile.ProfilePasswordUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.profile.ProfileResponse;
import bo.pasorapa.hato.service.dto.admin.profile.ProfileUpdateRequest;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/admin/profile")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AdminProfileResource {

    private final AdminProfileService adminProfileService;
    private final JsonWebToken jsonWebToken;

    public AdminProfileResource(AdminProfileService adminProfileService, JsonWebToken jsonWebToken) {
        this.adminProfileService = adminProfileService;
        this.jsonWebToken = jsonWebToken;
    }

    @PUT
    public ProfileResponse updateProfile(@Valid ProfileUpdateRequest request) {
        return adminProfileService.updateProfile(currentUserId(), request);
    }

    @PUT
    @Path("/password")
    public ActionMessageResponse updatePassword(@Valid ProfilePasswordUpdateRequest request) {
        return adminProfileService.updatePassword(currentUserId(), request);
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}
