package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

@RegisterForReflection
public record PushSyncRequest(
        @NotEmpty List<@Valid SyncOperationRequest> operations
) {
}
