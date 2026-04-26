package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationRequest;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SyncServiceTest {

    @Inject
    SyncService syncService;

    @Inject
    AnimalRepository animalRepository;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(animalRepository::deleteAll);
    }

    @Test
    void shouldAcknowledgeDuplicateOperationReplayWithoutApplyingSecondMutation() {
        UUID animalUuid = UUID.fromString("16d8f889-f903-4f82-bfe5-3e28c6a6b5f0");
        seedAnimal(animalUuid, "BO-1001", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));

        PushSyncRequest firstRequest = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("6fc2bd5a-d70c-429c-ae15-2f0ea7a91f50"),
                SyncEntityType.ANIMAL,
                animalUuid.toString(),
                SyncOperationType.UPDATE,
                Map.of("tag", "BO-2001"),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncRequest replayRequest = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("6fc2bd5a-d70c-429c-ae15-2f0ea7a91f50"),
                SyncEntityType.ANIMAL,
                animalUuid.toString(),
                SyncOperationType.UPDATE,
                Map.of("tag", "BO-9999"),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(firstRequest);
        PushSyncResponse replayResponse = syncService.push(replayRequest);

        Animal persisted = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(animalUuid).orElseThrow());

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals("no_conflict", replayResponse.results().getFirst().classification());
        assertEquals(firstResponse.results().getFirst().serverVersion(), replayResponse.results().getFirst().serverVersion());
        assertEquals("BO-2001", persisted.getTag());
    }

    @Test
    void shouldReturnIncrementalAnimalDeltasAndAdvanceCursorFromLastItem() {
        seedAnimal(UUID.fromString("0f6cf3e2-1512-468b-a64f-ac976423dcf0"), "BO-3001", 1L, LocalDateTime.of(2026, 4, 26, 9, 0));
        seedAnimal(UUID.fromString("2ec4b651-0cd4-4c10-b0b3-650c828d6f08"), "BO-3002", 3L, LocalDateTime.of(2026, 4, 26, 12, 0));

        PullSyncResponse response = syncService.pull(
                SyncEntityType.ANIMAL,
                OffsetDateTime.of(2026, 4, 26, 10, 0, 0, 0, ZoneOffset.UTC),
                "11111111-1111-1111-1111-111111111111");

        assertEquals(1, response.items().size());
        assertEquals("2ec4b651-0cd4-4c10-b0b3-650c828d6f08", response.items().getFirst().get("uuid"));
        assertEquals(3, response.items().getFirst().get("version"));
        assertNotNull(response.items().getFirst().get("updatedAt"));
        assertEquals("2ec4b651-0cd4-4c10-b0b3-650c828d6f08", response.nextCursor().cursorId());
        assertNotNull(response.nextCursor().cursorUpdatedAt());
    }

    @Test
    void shouldClassifyStaleAnimalVersionAsConflictWithManualRefresh() {
        UUID animalUuid = UUID.fromString("3af6a5fd-f9e5-4b7c-9556-1e8e1251e313");
        seedAnimal(animalUuid, "BO-4001", 2L, LocalDateTime.of(2026, 4, 26, 11, 0));

        PushSyncResponse response = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("f60fd51d-a415-471f-ba99-e6c423b2c4c6"),
                SyncEntityType.ANIMAL,
                animalUuid.toString(),
                SyncOperationType.UPDATE,
                Map.of("tag", "BO-4002"),
                1,
                OffsetDateTime.parse("2026-04-26T11:05:00Z"),
                OffsetDateTime.parse("2026-04-26T11:05:00Z")))));

        assertEquals("version_conflict", response.results().getFirst().classification());
        assertEquals(2, response.results().getFirst().serverVersion());
        assertInstanceOf(Map.class, response.results().getFirst().conflict().serverState());
        assertEquals("manual_refresh", response.results().getFirst().conflict().resolutionHint());
    }

    private void seedAnimal(UUID uuid, String tag, Long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setCode("CODE-" + tag);
            animal.setTag(tag);
            animal.setUuid(uuid);
            animal.setVersion(version);
            animal.setCategory(AnimalCategory.COW);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 10));
            animal.setWeightKg(new BigDecimal("420.50"));
            animal.setCreatedAt(updatedAt.minusDays(1));
            animal.setUpdatedAt(updatedAt);
            animalRepository.persist(animal);
        });
    }
}
