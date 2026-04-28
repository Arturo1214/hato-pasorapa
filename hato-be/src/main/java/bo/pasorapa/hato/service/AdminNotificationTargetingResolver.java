package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class AdminNotificationTargetingResolver {

    public static final int EXPLICIT_RECIPIENT_LIMIT = 200;

    private final UserRepository userRepository;

    public AdminNotificationTargetingResolver(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Resolution resolve(AdminNotificationTargetingMode targetingMode, List<UUID> includeUserIds, List<UUID> excludeUserIds) {
        List<UUID> normalizedIncludes = deduplicate(includeUserIds);
        List<UUID> normalizedExcludes = deduplicate(excludeUserIds);

        if (targetingMode == AdminNotificationTargetingMode.EXPLICIT_LIST && normalizedIncludes.size() > EXPLICIT_RECIPIENT_LIMIT) {
            throw new BusinessException(
                    "ADMIN_NOTIFICATION_EXPLICIT_RECIPIENT_LIMIT_EXCEEDED",
                    "La lista explícita V1 soporta hasta 200 destinatarios.",
                    Response.Status.BAD_REQUEST);
        }

        LinkedHashSet<UUID> recipients = switch (targetingMode) {
            case ALL_ACTIVE_GANADEROS -> new LinkedHashSet<>(userRepository.listActiveGanaderoUserIds());
            case EXPLICIT_LIST -> new LinkedHashSet<>(resolveExplicitRecipients(normalizedIncludes));
        };

        recipients.removeAll(normalizedExcludes);
        if (recipients.isEmpty()) {
            throw new BusinessException(
                    "ADMIN_NOTIFICATION_RECIPIENTS_REQUIRED",
                    "La notificación debe resolver al menos un destinatario GANADERO activo.",
                    Response.Status.BAD_REQUEST);
        }

        return new Resolution(normalizedIncludes, normalizedExcludes, List.copyOf(recipients));
    }

    private List<UUID> resolveExplicitRecipients(List<UUID> includeUserIds) {
        if (includeUserIds.isEmpty()) {
            throw new BusinessException(
                    "ADMIN_NOTIFICATION_INCLUDE_REQUIRED",
                    "La targeting explícita requiere destinatarios seleccionados.",
                    Response.Status.BAD_REQUEST);
        }

        List<UUID> activeGanaderoIds = userRepository.listActiveGanaderoUserIdsByIds(includeUserIds);
        Set<UUID> allowed = Set.copyOf(activeGanaderoIds);
        if (allowed.size() != includeUserIds.size()) {
            throw new BusinessException(
                    "ADMIN_NOTIFICATION_INVALID_EXPLICIT_RECIPIENTS",
                    "Todos los destinatarios explícitos deben ser usuarios GANADERO activos.",
                    Response.Status.BAD_REQUEST);
        }

        return includeUserIds.stream().filter(allowed::contains).toList();
    }

    private List<UUID> deduplicate(List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        return List.copyOf(new LinkedHashSet<>(userIds));
    }

    public record Resolution(List<UUID> includeUserIds, List<UUID> excludeUserIds, List<UUID> recipientUserIds) {
    }
}
