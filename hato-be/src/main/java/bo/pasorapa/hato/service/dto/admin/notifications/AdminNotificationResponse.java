package bo.pasorapa.hato.service.dto.admin.notifications;

import java.util.List;

public record AdminNotificationResponse(
        String id,
        String title,
        String body,
        String targetingMode,
        List<String> includeUserIds,
        List<String> excludeUserIds,
        int recipientCount,
        String createdByUserId,
        String createdAt,
        String updatedAt,
        String publishedAt
) {
}
