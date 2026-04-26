package bo.pasorapa.hato.service.dto.admin.dashboard;

public record AdminDashboardSummary(
        long total,
        long active,
        long inactive,
        long blocked
) {
}
