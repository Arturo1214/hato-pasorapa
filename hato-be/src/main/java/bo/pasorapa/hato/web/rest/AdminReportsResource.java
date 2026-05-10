package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AdminReportsService;
import bo.pasorapa.hato.service.dto.admin.reports.HealthActivityFilter;
import bo.pasorapa.hato.service.dto.admin.reports.HealthActivityResponse;
import bo.pasorapa.hato.service.dto.admin.reports.InventoryByGanaderoFilter;
import bo.pasorapa.hato.service.dto.admin.reports.InventoryByGanaderoResponse;
import bo.pasorapa.hato.service.dto.admin.reports.NotificationReachFilter;
import bo.pasorapa.hato.service.dto.admin.reports.NotificationReachResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/admin/reports")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class AdminReportsResource {

    private final AdminReportsService adminReportsService;

    public AdminReportsResource(AdminReportsService adminReportsService) {
        this.adminReportsService = adminReportsService;
    }

    @GET
    @Path("/inventory-by-ganadero")
    public InventoryByGanaderoResponse inventoryByGanadero(@Valid @BeanParam InventoryByGanaderoFilter filter) {
        return adminReportsService.getInventoryByGanadero(filter);
    }

    @GET
    @Path("/health-activity")
    public HealthActivityResponse healthActivity(@Valid @BeanParam HealthActivityFilter filter) {
        return adminReportsService.getHealthActivity(filter);
    }

    @GET
    @Path("/notification-reach")
    public NotificationReachResponse notificationReach(@Valid @BeanParam NotificationReachFilter filter) {
        return adminReportsService.getNotificationReach(filter);
    }
}
