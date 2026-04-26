package bo.pasorapa.hato.service.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record AuthTokenRequest(
        @NotBlank String username,
        List<String> roles
) {
}

