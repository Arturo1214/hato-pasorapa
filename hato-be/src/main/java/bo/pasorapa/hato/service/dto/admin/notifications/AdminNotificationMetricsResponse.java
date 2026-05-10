package bo.pasorapa.hato.service.dto.admin.notifications;

public record AdminNotificationMetricsResponse(int totalCount, int readCount, int pendingCount) {
    public static AdminNotificationMetricsResponse empty() {
        return new AdminNotificationMetricsResponse(0, 0, 0);
    }
}
