package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record ConflictDiffField(
        String path,
        Object localValue,
        Object serverValue,
        String severity
) {
}
