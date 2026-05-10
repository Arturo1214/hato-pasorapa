package bo.pasorapa.hato.service.dto.admin.reports;

import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record NotificationReachResponse(List<NotificationReachRow> rows) {
    public record NotificationReachRow(
            UUID notificationId,
            String title,
            LocalDateTime publishedAt,
            AdminNotificationTargetingMode targetingMode,
            long totalRecipients,
            long readCount,
            long pendingCount,
            BigDecimal readRate) {}
}
