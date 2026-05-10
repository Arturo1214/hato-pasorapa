package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AdminNotificationService;
import bo.pasorapa.hato.service.dto.admin.common.ActionMessageResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.GanaderoNotificationInboxResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.GanaderoUnreadCountResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/notifications")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("GANADERO")
public class NotificationRecipientsResource {

    private final AdminNotificationService adminNotificationService;
    private final JsonWebToken jsonWebToken;

    public NotificationRecipientsResource(AdminNotificationService adminNotificationService, JsonWebToken jsonWebToken) {
        this.adminNotificationService = adminNotificationService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    @Path("/inbox")
    public GanaderoNotificationInboxResponse inbox() {
        return adminNotificationService.getInbox(currentUserId());
    }

    @GET
    @Path("/unread-count")
    public GanaderoUnreadCountResponse unreadCount() {
        return adminNotificationService.getUnreadCount(currentUserId());
    }

    @PATCH
    @Path("/recipients/{id}/read")
    public ActionMessageResponse markAsRead(@PathParam("id") UUID recipientId) {
        adminNotificationService.markRecipientAsRead(recipientId, currentUserId());
        return new ActionMessageResponse("Notificación marcada como leída.");
    }

    @PATCH
    @Path("/recipients/read")
    public ActionMessageResponse markAllAsRead() {
        adminNotificationService.markAllAsReadForUser(currentUserId());
        return new ActionMessageResponse("Notificaciones marcadas como leídas.");
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}
