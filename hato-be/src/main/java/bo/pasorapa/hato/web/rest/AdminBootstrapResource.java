package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AdminBootstrapService;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.dto.admin.bootstrap.AdminBootstrapRequest;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/admin/bootstrap")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AdminBootstrapResource {

    private final AdminBootstrapService adminBootstrapService;

    public AdminBootstrapResource(AdminBootstrapService adminBootstrapService) {
        this.adminBootstrapService = adminBootstrapService;
    }

    @POST
    public Response bootstrap(@Valid AdminBootstrapRequest request) {
        AuthLoginResponse response = adminBootstrapService.bootstrap(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }
}
