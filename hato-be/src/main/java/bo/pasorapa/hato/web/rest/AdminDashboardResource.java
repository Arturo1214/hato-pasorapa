package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AdminDashboardService;
import bo.pasorapa.hato.service.dto.admin.dashboard.AdminDashboardResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/admin/dashboard/users")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class AdminDashboardResource {

    private final AdminDashboardService adminDashboardService;

    public AdminDashboardResource(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GET
    public AdminDashboardResponse users() {
        return adminDashboardService.userMetrics();
    }
}
