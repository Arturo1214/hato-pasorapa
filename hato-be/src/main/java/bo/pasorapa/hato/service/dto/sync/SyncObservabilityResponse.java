package bo.pasorapa.hato.service.dto.sync;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;
import java.util.Map;

@RegisterForReflection
public record SyncObservabilityResponse(
        String window,
        List<SyncMetricDictionaryEntry> dictionary,
        Map<String, Long> totals,
        Map<String, Map<String, Long>> byEntity,
        List<TopReason> topReasons,
        ConflictSummary conflicts,
        Map<String, EntityHealth> entityHealth,
        LatencySummary latency,
        List<RecentIssue> recentIssues
) {
    @RegisterForReflection
public record TopReason(String reason, long count, String source) {
    }

    @RegisterForReflection
public record ConflictSummary(long open, long resolved, long blockedOperations) {
    }

    @RegisterForReflection
public record EntityHealth(
            String cursorUpdatedAt,
            String lastSuccessAt,
            Long stalenessMs,
            boolean stale
    ) {
    }

    @RegisterForReflection
public record LatencySummary(
            String latestReceiptAt,
            String oldestIssueAt,
            long staleThresholdMs
    ) {
    }

    @RegisterForReflection
public record RecentIssue(
            String source,
            String operationId,
            String entityType,
            String entityId,
            String status,
            String reason,
            String createdAt
    ) {
    }
}
