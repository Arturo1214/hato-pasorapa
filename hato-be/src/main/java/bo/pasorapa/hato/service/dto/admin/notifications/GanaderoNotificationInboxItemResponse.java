package bo.pasorapa.hato.service.dto.admin.notifications;

public record GanaderoNotificationInboxItemResponse(
        String recipientId,
        String id,
        String title,
        String body,
        boolean read,
        String readAt,
        String publishedAt
) {
}
