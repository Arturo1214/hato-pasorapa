package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.OperationLog;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.common.ActionMessageResponse;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserCreateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserPasswordUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserResponse;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserStatusUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUsersListResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.util.UUID;

@ApplicationScoped
public class AdminUserService {

    private final UserRepository userRepository;
    private final OperationLogRepository operationLogRepository;
    private final AuthService authService;

    public AdminUserService(UserRepository userRepository, OperationLogRepository operationLogRepository, AuthService authService) {
        this.userRepository = userRepository;
        this.operationLogRepository = operationLogRepository;
        this.authService = authService;
    }

    public AdminUsersListResponse list(UserStatus status) {
        return new AdminUsersListResponse(userRepository.listByStatus(status).stream().map(this::toResponse).toList());
    }

    @Transactional
    public MutationResult<AdminUserResponse> create(AdminUserCreateRequest request, UUID operationId, UUID performedByUserId) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            return new MutationResult<>(toResponse(findUser(existingOperation.getResourceId())), true);
        }

        validateRole(request.role());

        if (userRepository.existsByUsernameIgnoreCase(request.username().trim())) {
            throw new BusinessException("USERNAME_ALREADY_EXISTS", "El usuario ya existe.", Response.Status.CONFLICT);
        }

        if (userRepository.existsByEmailIgnoreCase(request.email().trim())) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS", "El correo ya existe.", Response.Status.CONFLICT);
        }

        User user = new User();
        user.setUsername(request.username().trim());
        user.setEmail(request.email().trim().toLowerCase());
        user.setDisplayName(request.displayName().trim());
        user.setRole(request.role());
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash(authService.hashPassword(request.password()));
        userRepository.persist(user);
        userRepository.flush();

        persistOperation(operationId, "ADMIN_USER_CREATED", user.getId(), performedByUserId);

        return new MutationResult<>(toResponse(user), false);
    }

    @Transactional
    public MutationResult<AdminUserResponse> updateStatus(UUID userId, AdminUserStatusUpdateRequest request, UUID operationId, UUID performedByUserId) {
        MutationResult<User> mutation = updateUserStatus(userId, request.status(), operationId, performedByUserId, "ADMIN_USER_STATUS_UPDATED", false);
        return new MutationResult<>(toResponse(mutation.data()), mutation.replayed());
    }

    @Transactional
    public MutationResult<AdminUserResponse> update(UUID userId, AdminUserUpdateRequest request, UUID operationId, UUID performedByUserId) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            return new MutationResult<>(toResponse(findUser(existingOperation.getResourceId())), true);
        }

        validateRole(request.role());

        User user = findUser(userId);
        String nextUsername = request.username().trim();
        String nextEmail = request.email().trim().toLowerCase();

        userRepository.findByUsernameOrEmail(nextUsername).ifPresent(existing -> {
            if (!existing.getId().equals(userId) && existing.getUsername().equalsIgnoreCase(nextUsername)) {
                throw new BusinessException("USERNAME_ALREADY_EXISTS", "El usuario ya existe.", Response.Status.CONFLICT);
            }
        });

        userRepository.findByUsernameOrEmail(nextEmail).ifPresent(existing -> {
            if (!existing.getId().equals(userId) && existing.getEmail().equalsIgnoreCase(nextEmail)) {
                throw new BusinessException("EMAIL_ALREADY_EXISTS", "El correo ya existe.", Response.Status.CONFLICT);
            }
        });

        user.setUsername(nextUsername);
        user.setEmail(nextEmail);
        user.setDisplayName(request.displayName().trim());
        user.setRole(request.role());
        userRepository.persist(user);
        userRepository.flush();

        persistOperation(operationId, "ADMIN_USER_UPDATED", user.getId(), performedByUserId);
        return new MutationResult<>(toResponse(user), false);
    }

    @Transactional
    public MutationResult<User> syncUpdateStatus(UUID userId, UserStatus status, UUID operationId, UUID performedByUserId) {
        return updateUserStatus(userId, status, operationId, performedByUserId, "SYNC_USER_STATUS_UPDATED", true);
    }

    @Transactional
    public MutationResult<ActionMessageResponse> updatePassword(UUID userId, AdminUserPasswordUpdateRequest request, UUID operationId, UUID performedByUserId) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            return new MutationResult<>(new ActionMessageResponse("Contraseña actualizada correctamente."), true);
        }

        User user = findUser(userId);
        user.setPasswordHash(authService.hashPassword(request.password()));
        userRepository.persist(user);
        userRepository.flush();

        persistOperation(operationId, "ADMIN_USER_PASSWORD_UPDATED", user.getId(), performedByUserId);

        return new MutationResult<>(new ActionMessageResponse("Contraseña actualizada correctamente."), false);
    }

    private MutationResult<User> updateUserStatus(
            UUID userId,
            UserStatus status,
            UUID operationId,
            UUID performedByUserId,
            String action,
            boolean synced) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            return new MutationResult<>(findUser(existingOperation.getResourceId()), true);
        }

        User user = findUser(userId);
        user.setStatus(status);
        if (synced) {
            user.setLastSyncedAt(LocalDateTime.now());
        }
        userRepository.persist(user);
        userRepository.flush();

        persistOperation(operationId, action, user.getId(), performedByUserId);
        return new MutationResult<>(user, false);
    }

    private User findUser(UUID userId) {
        return userRepository.findByIdOptional(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario solicitado.", Response.Status.NOT_FOUND));
    }

    private void validateRole(Role role) {
        if (role != Role.ADMIN && role != Role.GANADERO) {
            throw new BusinessException("ROLE_NOT_ALLOWED", "Solo se permiten roles ADMIN y GANADERO.", Response.Status.BAD_REQUEST);
        }
    }

    private void persistOperation(UUID operationId, String action, UUID resourceId, UUID performedByUserId) {
        OperationLog operationLog = new OperationLog();
        operationLog.setOperationId(operationId);
        operationLog.setAction(action);
        operationLog.setResourceType("USER");
        operationLog.setResourceId(resourceId);
        operationLog.setPerformedByUserId(performedByUserId);
        operationLogRepository.persist(operationLog);
    }

    private AdminUserResponse toResponse(User user) {
        return new AdminUserResponse(
                user.getId().toString(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getVersion() == null ? 0L : user.getVersion(),
                user.getCreatedAt() == null ? null : user.getCreatedAt().toString(),
                user.getUpdatedAt() == null ? null : user.getUpdatedAt().toString(),
                user.getLastSyncedAt() == null ? null : user.getLastSyncedAt().toString());
    }
}
