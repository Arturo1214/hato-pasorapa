package bo.pasorapa.hato.service.dto.sync;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record PushSyncRequest(
        @NotEmpty List<@Valid SyncOperationRequest> operations
) {
}
