package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.OperationLog;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.dto.admin.bootstrap.AdminBootstrapRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@ApplicationScoped
public class AdminBootstrapService {

    private final UserRepository userRepository;
    private final OperationLogRepository operationLogRepository;
    private final AuthService authService;

    public AdminBootstrapService(UserRepository userRepository, OperationLogRepository operationLogRepository, AuthService authService) {
        this.userRepository = userRepository;
        this.operationLogRepository = operationLogRepository;
        this.authService = authService;
    }

    @Transactional
    public AuthLoginResponse bootstrap(AdminBootstrapRequest request) {
        if (userRepository.hasActiveAdmin()) {
            throw new BusinessException(
                    "BOOTSTRAP_ALREADY_COMPLETED",
                    "Ya existe un administrador activo. El bootstrap inicial ya fue ejecutado.",
                    Response.Status.CONFLICT);
        }

        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new BusinessException("USERNAME_ALREADY_EXISTS", "El usuario ya existe.", Response.Status.CONFLICT);
        }

        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS", "El correo ya existe.", Response.Status.CONFLICT);
        }

        User user = new User();
        user.setUsername(request.username().trim());
        user.setEmail(request.email().trim().toLowerCase());
        user.setDisplayName(request.displayName().trim());
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash(authService.hashPassword(request.password()));
        userRepository.persist(user);
        userRepository.flush();

        OperationLog operationLog = new OperationLog();
        operationLog.setOperationId(UUID.randomUUID());
        operationLog.setAction("ADMIN_BOOTSTRAP");
        operationLog.setResourceType("USER");
        operationLog.setResourceId(user.getId());
        operationLog.setPerformedByUserId(user.getId());
        operationLogRepository.persist(operationLog);

        return authService.issueToken(user);
    }
}
