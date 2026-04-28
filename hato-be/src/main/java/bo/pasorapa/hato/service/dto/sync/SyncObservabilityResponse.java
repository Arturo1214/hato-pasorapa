package bo.pasorapa.hato.service.dto.sync;

import java.util.List;
import java.util.Map;

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
    public record TopReason(String reason, long count, String source) {
    }

    public record ConflictSummary(long open, long resolved, long blockedOperations) {
    }

    public record EntityHealth(
            String cursorUpdatedAt,
            String lastSuccessAt,
            Long stalenessMs,
            boolean stale
    ) {
    }

    public record LatencySummary(
            String latestReceiptAt,
            String oldestIssueAt,
            long staleThresholdMs
    ) {
    }

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
