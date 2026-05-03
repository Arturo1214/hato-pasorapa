package bo.pasorapa.hato.service.dto.admin.profile;

import bo.pasorapa.hato.service.AuthService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ProfilePasswordUpdateRequest(
        @NotBlank String currentPassword,
        @NotBlank @Pattern(regexp = AuthService.PASSWORD_POLICY_REGEX, message = AuthService.PASSWORD_POLICY_MESSAGE) String newPassword
) {
}
