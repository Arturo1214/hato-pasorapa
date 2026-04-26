package bo.pasorapa.hato.service.dto.admin.dashboard;

public record AdminDashboardResponse(
        AdminDashboardSummary admins,
        AdminDashboardSummary ganaderos
) {
}
