package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.OperationLog;
import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationCreateRequest;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationListResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationMetricsResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.GanaderoNotificationInboxResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.GanaderoUnreadCountResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AdminNotificationMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class AdminNotificationService {

    private final AdminNotificationRepository adminNotificationRepository;
    private final AdminNotificationRecipientRepository adminNotificationRecipientRepository;
    private final OperationLogRepository operationLogRepository;
    private final AdminNotificationTargetingResolver targetingResolver;
    private final AdminNotificationMapper adminNotificationMapper;

    public AdminNotificationService(
            AdminNotificationRepository adminNotificationRepository,
            AdminNotificationRecipientRepository adminNotificationRecipientRepository,
            OperationLogRepository operationLogRepository,
            AdminNotificationTargetingResolver targetingResolver,
            AdminNotificationMapper adminNotificationMapper) {
        this.adminNotificationRepository = adminNotificationRepository;
        this.adminNotificationRecipientRepository = adminNotificationRecipientRepository;
        this.operationLogRepository = operationLogRepository;
        this.targetingResolver = targetingResolver;
        this.adminNotificationMapper = adminNotificationMapper;
    }

    public AdminNotificationListResponse listIssuedNotifications() {
        Map<UUID, AdminNotificationMetricsResponse> metricsByNotificationId = groupedMetricsByNotificationId();
        return new AdminNotificationListResponse(adminNotificationRepository.listIssuedNotifications().stream()
                .map(notification -> adminNotificationMapper.toResponse(
                        notification,
                        metricsByNotificationId.getOrDefault(notification.getId(), AdminNotificationMetricsResponse.empty())))
                .toList());
    }

    public AdminNotificationResponse getNotificationWithMetrics(UUID notificationId) {
        AdminNotification notification = adminNotificationRepository.findByIdOptional(notificationId)
                .orElseThrow(() -> new BusinessException(
                        "ADMIN_NOTIFICATION_NOT_FOUND",
                        "No encontramos la notificación solicitada.",
                        Response.Status.NOT_FOUND));
        return adminNotificationMapper.toResponse(
                notification,
                groupedMetricsByNotificationId().getOrDefault(notificationId, AdminNotificationMetricsResponse.empty()));
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
            recipient.setRead(false);
            recipient.setCreatedAt(notification.getPublishedAt());
            recipient.setUpdatedAt(notification.getPublishedAt());
            adminNotificationRepository.getEntityManager().persist(recipient);
        }
        adminNotificationRepository.getEntityManager().flush();

        persistOperation(operationId, notification.getId(), performedByUserId);

        return new MutationResult<>(adminNotificationMapper.toResponse(notification), false);
    }

    public long countUnread(UUID userId) {
        return adminNotificationRecipientRepository.countByRecipientUserIdAndReadFalse(userId);
    }

    public GanaderoNotificationInboxResponse getInbox(UUID userId) {
        return new GanaderoNotificationInboxResponse(adminNotificationRecipientRepository.getOwnedInbox(userId).stream()
                .map(adminNotificationMapper::toInboxItem)
                .toList());
    }

    public GanaderoUnreadCountResponse getUnreadCount(UUID userId) {
        return new GanaderoUnreadCountResponse(adminNotificationRecipientRepository.countByRecipientUserIdAndReadFalse(userId));
    }

    @Transactional
    public void markRecipientAsRead(UUID recipientId, UUID userId) {
        AdminNotificationRecipient recipient = adminNotificationRecipientRepository.findByIdWithNotification(recipientId)
                .orElseThrow(() -> new BusinessException(
                        "ADMIN_NOTIFICATION_RECIPIENT_NOT_FOUND",
                        "No encontramos la notificación solicitada para este usuario.",
                        Response.Status.NOT_FOUND));
        if (!recipient.getRecipientUserId().equals(userId)) {
            throw new BusinessException(
                    "ADMIN_NOTIFICATION_RECIPIENT_FORBIDDEN",
                    "No podés modificar notificaciones de otro usuario.",
                    Response.Status.FORBIDDEN);
        }
        recipient.setRead(true);
        recipient.setUpdatedAt(LocalDateTime.now());
    }

    @Transactional
    public void markAllAsReadForUser(UUID userId) {
        adminNotificationRecipientRepository.markAllAsReadForUser(userId);
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

    private Map<UUID, AdminNotificationMetricsResponse> groupedMetricsByNotificationId() {
        return adminNotificationRecipientRepository.getGroupedMetrics().stream()
                .map(row -> new AdminNotificationMetricsRow(
                        row.notificationId(),
                        new AdminNotificationMetricsResponse(
                                Math.toIntExact(row.totalCount()),
                                Math.toIntExact(row.readCount()),
                                row.pendingCount())))
                .collect(Collectors.toMap(
                        AdminNotificationMetricsRow::notificationId,
                        AdminNotificationMetricsRow::metrics,
                        (existing, replacement) -> existing));
    }

    private record AdminNotificationMetricsRow(UUID notificationId, AdminNotificationMetricsResponse metrics) {
    }
}
