package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.OperationLog;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationCreateRequest;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationListResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationResponse;
import bo.pasorapa.hato.service.mapper.AdminNotificationMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class AdminNotificationService {

    private final AdminNotificationRepository adminNotificationRepository;
    private final OperationLogRepository operationLogRepository;
    private final AdminNotificationTargetingResolver targetingResolver;
    private final AdminNotificationMapper adminNotificationMapper;

    public AdminNotificationService(
            AdminNotificationRepository adminNotificationRepository,
            OperationLogRepository operationLogRepository,
            AdminNotificationTargetingResolver targetingResolver,
            AdminNotificationMapper adminNotificationMapper) {
        this.adminNotificationRepository = adminNotificationRepository;
        this.operationLogRepository = operationLogRepository;
        this.targetingResolver = targetingResolver;
        this.adminNotificationMapper = adminNotificationMapper;
    }

    public AdminNotificationListResponse listIssuedNotifications() {
        return new AdminNotificationListResponse(adminNotificationRepository.listIssuedNotifications().stream()
                .map(adminNotificationMapper::toResponse)
                .toList());
    }

    @Transactional
    public MutationResult<AdminNotificationResponse> create(
            AdminNotificationCreateRequest request,
            UUID operationId,
            UUID performedByUserId) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            AdminNotification existingNotification = adminNotificationRepository.findById(existingOperation.getResourceId());
            return new MutationResult<>(adminNotificationMapper.toResponse(existingNotification), true);
        }

        AdminNotificationTargetingResolver.Resolution resolution = targetingResolver.resolve(
                request.targetingMode(),
                request.includeUserIds(),
                request.excludeUserIds());

        AdminNotification notification = new AdminNotification();
        notification.setTitle(request.title().trim());
        notification.setBody(request.body().trim());
        notification.setTargetingMode(request.targetingMode());
        notification.setIncludeUserIdsJson(adminNotificationMapper.writeUuidList(resolution.includeUserIds()));
        notification.setExcludeUserIdsJson(adminNotificationMapper.writeUuidList(resolution.excludeUserIds()));
        notification.setRecipientCount(resolution.recipientUserIds().size());
        notification.setCreatedByUserId(performedByUserId);
        notification.setPublishedAt(LocalDateTime.now());
        adminNotificationRepository.persist(notification);
        adminNotificationRepository.flush();

        for (UUID recipientUserId : resolution.recipientUserIds()) {
            AdminNotificationRecipient recipient = new AdminNotificationRecipient();
            recipient.setNotification(notification);
            recipient.setRecipientUserId(recipientUserId);
            recipient.setCreatedAt(notification.getPublishedAt());
            recipient.setUpdatedAt(notification.getPublishedAt());
            adminNotificationRepository.getEntityManager().persist(recipient);
        }
        adminNotificationRepository.getEntityManager().flush();

        persistOperation(operationId, notification.getId(), performedByUserId);

        return new MutationResult<>(adminNotificationMapper.toResponse(notification), false);
    }

    private void persistOperation(UUID operationId, UUID resourceId, UUID performedByUserId) {
        OperationLog operationLog = new OperationLog();
        operationLog.setOperationId(operationId);
        operationLog.setAction("ADMIN_NOTIFICATION_CREATED");
        operationLog.setResourceType("ADMIN_NOTIFICATION");
        operationLog.setResourceId(resourceId);
        operationLog.setPerformedByUserId(performedByUserId);
        operationLogRepository.persist(operationLog);
    }
}
