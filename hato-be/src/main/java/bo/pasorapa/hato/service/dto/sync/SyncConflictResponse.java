package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

@RegisterForReflection
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
