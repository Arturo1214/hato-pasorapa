package bo.pasorapa.hato.service.dto.sync;

import java.util.List;

public record SyncConflictResponse(
        String entityId,
        Integer clientVersion,
        Integer serverVersion,
        String reason,
        String resolutionHint,
        Object serverState,
        Integer serverStateVersion,
        List<ConflictDiffField> diffFields,
        ResolutionPolicyResponse policy,
        List<String> allowedActions,
        String policyKey
) {
}
