package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record SyncMetricDictionaryEntry(
        String key,
        String label,
        String category,
        String description
) {
}
