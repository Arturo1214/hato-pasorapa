package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

@RegisterForReflection
public record ResolutionPolicyResponse(
        SyncEntityType entityType,
        SyncOperationType opType,
        List<String> allowedActions,
        String uxHint,
        String policyKey,
        String policyVersion
) {
}
