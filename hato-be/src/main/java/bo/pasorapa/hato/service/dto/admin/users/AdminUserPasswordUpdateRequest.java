package bo.pasorapa.hato.service.dto.admin.users;

import bo.pasorapa.hato.service.AuthService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminUserPasswordUpdateRequest(
        @NotBlank
        @Size(min = 8)
        @Pattern(regexp = AuthService.PASSWORD_POLICY_REGEX, message = AuthService.PASSWORD_POLICY_MESSAGE) String password
) {
}
