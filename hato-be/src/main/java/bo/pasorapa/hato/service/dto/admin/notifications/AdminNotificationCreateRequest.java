package bo.pasorapa.hato.service.dto.admin.notifications;

import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record AdminNotificationCreateRequest(
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 2000) String body,
        @NotNull AdminNotificationTargetingMode targetingMode,
        List<UUID> includeUserIds,
        List<UUID> excludeUserIds
) {
}
