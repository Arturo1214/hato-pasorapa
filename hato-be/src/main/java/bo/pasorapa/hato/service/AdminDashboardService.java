package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.dashboard.AdminDashboardResponse;
import bo.pasorapa.hato.service.dto.admin.dashboard.AdminDashboardSummary;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AdminDashboardService {

    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;

    public AdminDashboardService(UserRepository userRepository, GanaderoRepository ganaderoRepository) {
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
    }

    public AdminDashboardResponse userMetrics() {
        return new AdminDashboardResponse(buildUserSummary(Role.ADMIN), buildGanaderoSummary());
    }

    private AdminDashboardSummary buildUserSummary(Role role) {
        return new AdminDashboardSummary(
                userRepository.countByRole(role),
                userRepository.countByRoleAndStatus(role, UserStatus.ACTIVE),
                userRepository.countByRoleAndStatus(role, UserStatus.INACTIVE),
                userRepository.countByRoleAndStatus(role, UserStatus.BLOCKED));
    }

    private AdminDashboardSummary buildGanaderoSummary() {
        long active = ganaderoRepository.countByActive(true);
        long inactive = ganaderoRepository.countByActive(false);
        return new AdminDashboardSummary(active + inactive, active, inactive, 0);
    }
}
