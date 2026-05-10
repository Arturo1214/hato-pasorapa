package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationMetricsResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationResponse;
import bo.pasorapa.hato.service.dto.admin.notifications.GanaderoNotificationInboxItemResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AdminNotificationMapper {

    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public AdminNotificationMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public AdminNotificationResponse toResponse(AdminNotification notification) {
        return toResponse(notification, null);
    }

    public AdminNotificationResponse toResponse(AdminNotification notification, AdminNotificationMetricsResponse deliveryMetrics) {
        return new AdminNotificationResponse(
                notification.getId().toString(),
                notification.getTitle(),
                notification.getBody(),
                notification.getTargetingMode().name(),
                readUuidList(notification.getIncludeUserIdsJson()),
                readUuidList(notification.getExcludeUserIdsJson()),
                notification.getRecipientCount(),
                notification.getCreatedByUserId().toString(),
                notification.getCreatedAt().atOffset(ZoneOffset.UTC).toString(),
                notification.getUpdatedAt().atOffset(ZoneOffset.UTC).toString(),
                notification.getPublishedAt().atOffset(ZoneOffset.UTC).toString(),
                deliveryMetrics);
    }

    public GanaderoNotificationInboxItemResponse toInboxItem(AdminNotificationRecipient recipient) {
        AdminNotification notification = recipient.getNotification();
        return new GanaderoNotificationInboxItemResponse(
                recipient.getId().toString(),
                notification.getId().toString(),
                notification.getTitle(),
                notification.getBody(),
                recipient.isRead(),
                recipient.isRead() ? recipient.getUpdatedAt().atOffset(ZoneOffset.UTC).toString() : null,
                notification.getPublishedAt().atOffset(ZoneOffset.UTC).toString());
    }

    public Map<String, Object> toPullItem(AdminNotificationRecipient recipient) {
        AdminNotification notification = recipient.getNotification();
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", notification.getId().toString());
        item.put("title", notification.getTitle());
        item.put("body", notification.getBody());
        item.put("createdByUserId", notification.getCreatedByUserId().toString());
        item.put("createdAt", notification.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("publishedAt", notification.getPublishedAt().atOffset(ZoneOffset.UTC));
        item.put("updatedAt", recipient.getUpdatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    public String writeUuidList(List<UUID> userIds) {
        try {
            return objectMapper.writeValueAsString(userIds == null ? List.of() : userIds.stream().map(UUID::toString).toList());
        } catch (Exception exception) {
            throw new IllegalStateException("Could not serialize admin notification targeting ids.", exception);
        }
    }

    public List<String> readUuidList(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(rawValue, STRING_LIST_TYPE);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not deserialize admin notification targeting ids.", exception);
        }
    }
}
