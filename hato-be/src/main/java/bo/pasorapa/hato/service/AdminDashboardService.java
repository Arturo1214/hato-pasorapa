package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.dashboard.AdminDashboardResponse;
import bo.pasorapa.hato.service.dto.admin.dashboard.AdminDashboardSummary;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AdminDashboardService {

    private final UserRepository userRepository;

    public AdminDashboardService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public AdminDashboardResponse userMetrics() {
        return new AdminDashboardResponse(buildSummary(Role.ADMIN), buildSummary(Role.GANADERO));
    }

    private AdminDashboardSummary buildSummary(Role role) {
        return new AdminDashboardSummary(
                userRepository.countByRole(role),
                userRepository.countByRoleAndStatus(role, UserStatus.ACTIVE),
                userRepository.countByRoleAndStatus(role, UserStatus.INACTIVE),
                userRepository.countByRoleAndStatus(role, UserStatus.BLOCKED));
    }
}
