package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RegisterForReflection
public record ResolveConflictRequest(
        @NotBlank(message = "SYNC_CONFLICT_ACTION_REQUIRED") String action,
        @NotBlank(message = "SYNC_CONFLICT_REASON_REQUIRED")
        @Size(max = 500, message = "SYNC_CONFLICT_REASON_TOO_LONG") String reason
) {
}
