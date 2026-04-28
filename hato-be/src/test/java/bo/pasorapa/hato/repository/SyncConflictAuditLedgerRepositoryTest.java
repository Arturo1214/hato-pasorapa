package bo.pasorapa.hato.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.SyncConflictAuditLedger;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SyncConflictAuditLedgerRepositoryTest {

    @Inject
    SyncConflictAuditLedgerRepository repository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(integrationDatabaseCleaner::clean);
    }

    @Test
    void shouldListEntriesByOperationIdInChronologicalOrder() {
        UUID operationId = UUID.fromString("24af3f26-bf93-4d8b-a3b3-fa1baf8dad02");
        persistEntry(operationId, "DETECTED", null, "2026-04-28T10:00:00");
        persistEntry(operationId, "RESOLVED", "retry_local", "2026-04-28T10:10:00");
        persistEntry(UUID.fromString("ee0c93ea-a8af-4059-b1b9-0541a3b28db7"), "DETECTED", null, "2026-04-28T09:59:00");

        List<SyncConflictAuditLedger> entries = QuarkusTransaction.requiringNew().call(() -> repository.listByOperationId(operationId));

        assertEquals(2, entries.size());
        assertEquals("DETECTED", entries.get(0).getEventType());
        assertEquals("RESOLVED", entries.get(1).getEventType());
        assertEquals("retry_local", entries.get(1).getDecision());
    }

    private void persistEntry(UUID operationId, String eventType, String decision, String createdAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            SyncConflictAuditLedger entry = new SyncConflictAuditLedger();
            entry.setOperationId(operationId);
            entry.setEntityType("ANIMAL");
            entry.setEntityId("animal-1");
            entry.setOperationType("UPDATE");
            entry.setEventType(eventType);
            entry.setDecision(decision);
            entry.setResultStatus(decision == null ? null : "pending");
            entry.setReason(eventType);
            entry.setPolicyKey("offline-conflict-resolution/v2/ANIMAL/UPDATE");
            entry.setRetentionExpiresAt(LocalDateTime.parse(createdAt).plusDays(365));
            entry.setCreatedAt(LocalDateTime.parse(createdAt));
            repository.persist(entry);
        });
    }
}
