package bo.pasorapa.hato.service.dto.admin.users;

import bo.pasorapa.hato.domain.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AdminUserUpdateRequest(
        @NotBlank String username,
        @Email @NotBlank String email,
        @NotBlank String displayName,
        @NotNull Role role
) {
}
