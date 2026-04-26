package bo.pasorapa.hato.service.dto.admin.users;

import bo.pasorapa.hato.domain.UserStatus;
import jakarta.validation.constraints.NotNull;

public record AdminUserStatusUpdateRequest(@NotNull UserStatus status) {
}
