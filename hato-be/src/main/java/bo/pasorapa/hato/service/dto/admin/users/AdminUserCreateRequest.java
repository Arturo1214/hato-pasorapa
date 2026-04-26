package bo.pasorapa.hato.service.dto.admin.users;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.service.AuthService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminUserCreateRequest(
        @NotBlank String username,
        @Email @NotBlank String email,
        @NotBlank String displayName,
        @NotNull Role role,
        @NotBlank
        @Size(min = 8)
        @Pattern(regexp = AuthService.PASSWORD_POLICY_REGEX, message = AuthService.PASSWORD_POLICY_MESSAGE) String password
) {
}
