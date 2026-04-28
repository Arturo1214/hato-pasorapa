package bo.pasorapa.hato.service.dto.sync;

import java.util.List;

public record ResolutionPolicyResponse(
        SyncEntityType entityType,
        SyncOperationType opType,
        List<String> allowedActions,
        String uxHint,
        String policyKey,
        String policyVersion
) {
}
