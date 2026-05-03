package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.GanaderoDashboardService;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.AnimalsSummaryResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UpcomingEventResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UpcomingVisitResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UnreadCountResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/ganadero/dashboard")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("GANADERO")
public class GanaderoDashboardResource {

    private final GanaderoDashboardService ganaderoDashboardService;
    private final JsonWebToken jsonWebToken;

    public GanaderoDashboardResource(GanaderoDashboardService ganaderoDashboardService, JsonWebToken jsonWebToken) {
        this.ganaderoDashboardService = ganaderoDashboardService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    @Path("/animals-summary")
    public AnimalsSummaryResponse animalsSummary(@QueryParam("ganaderoId") String ganaderoId) {
        rejectGanaderoId(ganaderoId);
        return ganaderoDashboardService.animalsSummary(currentUserId());
    }

    @GET
    @Path("/upcoming-events")
    public List<UpcomingEventResponse> upcomingEvents(@QueryParam("limit") Integer limit, @QueryParam("ganaderoId") String ganaderoId) {
        rejectGanaderoId(ganaderoId);
        return ganaderoDashboardService.upcomingEvents(currentUserId(), normalizeLimit(limit));
    }

    @GET
    @Path("/unread-count")
    public UnreadCountResponse unreadCount() {
        return ganaderoDashboardService.unreadCount(currentUserId());
    }

    @GET
    @Path("/upcoming-visits")
    public List<UpcomingVisitResponse> upcomingVisits(@QueryParam("limit") Integer limit, @QueryParam("ganaderoId") String ganaderoId) {
        rejectGanaderoId(ganaderoId);
        return ganaderoDashboardService.upcomingVisits(currentUserId(), normalizeLimit(limit));
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }

    private int normalizeLimit(Integer limit) {
        int effectiveLimit = limit == null ? 5 : limit;
        if (effectiveLimit < 1 || effectiveLimit > 10) {
            throw new BusinessException("GANADERO_DASHBOARD_LIMIT_INVALID", "El parámetro limit debe estar entre 1 y 10.", Response.Status.BAD_REQUEST);
        }
        return effectiveLimit;
    }

    private void rejectGanaderoId(String ganaderoId) {
        if (ganaderoId != null && !ganaderoId.isBlank()) {
            throw new BusinessException("GANADERO_DASHBOARD_GANADERO_ID_FORBIDDEN", "No se permite informar ganaderoId explícito.", Response.Status.BAD_REQUEST);
        }
    }
}
