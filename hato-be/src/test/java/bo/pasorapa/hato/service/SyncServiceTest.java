package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.AnimalImage;
import bo.pasorapa.hato.domain.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalImageRepository;
import bo.pasorapa.hato.repository.AnimalReproductionEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.SyncConflictAuditLedgerRepository;
import bo.pasorapa.hato.repository.SyncOperationReceiptRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.mapper.SyncPayloadMapper;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationCreateRequest;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.ResolveConflictRequest;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationRequest;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import bo.pasorapa.hato.service.error.BusinessException;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import bo.pasorapa.hato.support.sync.SyncHarnessFixtures;

@QuarkusTest
class SyncServiceTest {

    // CI V1 gate: [smoke] corre siempre en pipeline por defecto; [stress] queda manual/on-demand.

    private static final UUID DEFAULT_OWNER_GANADERO_ID = UUID.fromString("6c4ab5c9-c9df-4b06-a858-ecbda97453f9");

    private SyncHarnessFixtures fixtures;

    @Inject
    SyncService syncService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventRepository animalEventRepository;

    @Inject
    AnimalHealthEventRepository animalHealthEventRepository;

    @Inject
    AnimalImageRepository animalImageRepository;

    @Inject
    AnimalReproductionEventRepository animalReproductionEventRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    SyncOperationReceiptRepository syncOperationReceiptRepository;

    @Inject
    SyncConflictAuditLedgerRepository syncConflictAuditLedgerRepository;

    @Inject
    SyncPayloadMapper syncPayloadMapper;

    @Inject
    AdminNotificationService adminNotificationService;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        fixtures = new SyncHarnessFixtures(animalRepository, ganaderoRepository, userRepository);
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            Ganadero owner = new Ganadero();
            owner.setId(DEFAULT_OWNER_GANADERO_ID);
            owner.setBusinessIdentifier("NIT-ANIMAL-SYNC");
            owner.setName("Ganadero Sync");
            owner.setActive(true);
            ganaderoRepository.persist(owner);
            ganaderoRepository.flush();
            ganaderoRepository.getEntityManager()
                    .createNativeQuery("update ganaderos set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, 0L)
                    .setParameter(2, LocalDateTime.of(2020, 1, 1, 0, 0))
                    .setParameter(3, LocalDateTime.of(2020, 1, 1, 0, 0))
                    .setParameter(4, DEFAULT_OWNER_GANADERO_ID)
                    .executeUpdate();
        });
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
    @DisplayName("[smoke] should keep duplicate operationId idempotent in a mixed USER/ANIMAL batch")
    void shouldKeepMixedBatchDuplicateOperationIdsIdempotent() {
        UUID animalUuid = UUID.fromString("11111111-1111-4111-8111-111111111111");
        UUID userId = UUID.fromString("22222222-2222-4222-8222-222222222222");
        UUID actorId = SyncHarnessFixtures.DEFAULT_ACTOR_USER_ID;
        fixtures.seedAnimal(animalUuid, "BO-MIXED-1", 0L, LocalDateTime.of(2026, 4, 28, 9, 0));
        fixtures.seedUser(userId, "mixed-user", "mixed-user@hato.bo", Role.GANADERO, UserStatus.ACTIVE, 0L, LocalDateTime.of(2026, 4, 28, 9, 5));

        PushSyncRequest request = fixtures.pushRequest(
                fixtures.userStatusUpdate(UUID.fromString("33333333-3333-4333-8333-333333333333"), userId, "INACTIVE", 0, "2026-04-28T10:05:00Z"),
                fixtures.animalUpdate(UUID.fromString("44444444-4444-4444-8444-444444444444"), animalUuid, "BO-MIXED-2", 0, "2026-04-28T10:05:00Z"));

        PushSyncResponse firstResponse = syncService.push(request, actorId);
        PushSyncResponse replayResponse = syncService.push(request, actorId);

        Animal persistedAnimal = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(animalUuid).orElseThrow());
        User persistedUser = QuarkusTransaction.requiringNew().call(() -> userRepository.findByIdOptional(userId).orElseThrow());

        assertEquals(List.of("33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"),
                firstResponse.results().stream().map(result -> result.operationId().toString()).toList());
        assertEquals(firstResponse.results().stream().map(result -> result.classification()).toList(),
                replayResponse.results().stream().map(result -> result.classification()).toList());
        assertEquals("INACTIVE", persistedUser.getStatus().name());
        assertEquals("BO-MIXED-2", persistedAnimal.getTag());
    }

    @Test
    @DisplayName("[smoke] should drain incremental animal pull with monotonic cursors until hasMore=false")
    void shouldDrainIncrementalAnimalPullWithHasMore() {
        fixtures.seedAnimalPage("HARNESS-", 101, LocalDateTime.of(2026, 4, 28, 8, 0));
        OffsetDateTime cursorUpdatedAt = OffsetDateTime.parse("2026-04-28T07:59:00Z");
        String cursorId = "00000000-0000-0000-0000-000000000001";
        List<SyncHarnessFixtures.PullPageExpectation> expectations = List.of(
                new SyncHarnessFixtures.PullPageExpectation(true, SyncHarnessFixtures.stableUuid("HARNESS-100").toString(), 100),
                new SyncHarnessFixtures.PullPageExpectation(false, SyncHarnessFixtures.stableUuid("HARNESS-101").toString(), 1));

        OffsetDateTime previousCursorUpdatedAt = null;
        for (int page = 0; page < expectations.size(); page += 1) {
            PullSyncResponse response = syncService.pull(SyncEntityType.ANIMAL, cursorUpdatedAt, cursorId);
            SyncHarnessFixtures.PullPageExpectation expected = expectations.get(page);

            assertEquals(expected.hasMore(), response.hasMore());
            assertEquals(expected.itemCount(), response.items().size());
            assertEquals(expected.nextCursorId(), response.nextCursor().cursorId());
            assertNotNull(response.nextCursor().cursorUpdatedAt());
            if (previousCursorUpdatedAt != null) {
                assertTrue(!response.nextCursor().cursorUpdatedAt().isBefore(previousCursorUpdatedAt));
            }

            previousCursorUpdatedAt = response.nextCursor().cursorUpdatedAt();
            cursorUpdatedAt = response.nextCursor().cursorUpdatedAt();
            cursorId = response.nextCursor().cursorId();
            if (!response.hasMore()) {
                break;
            }
        }
    }

    @Test
    void shouldCreateAnimalEventOfflineIdempotentlyAndProjectCurrentAnimalState() {
        UUID animalUuid = UUID.fromString("2f3de007-c8be-4814-8c6d-36364eb4941a");
        UUID operationId = UUID.fromString("1f769935-7c45-4872-94ae-287fa737cf5b");
        UUID targetOwnerId = UUID.fromString("2172cce9-9e65-4986-b4a6-bb5fc6c7f26f");
        seedGanadero(targetOwnerId, "NIT-TARGET", "Ganadero destino", 0L, LocalDateTime.of(2026, 4, 26, 9, 30));
        seedAnimal(animalUuid, "BO-1500", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));

        PushSyncRequest request = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.ANIMAL_EVENT,
                operationId.toString(),
                SyncOperationType.CREATE,
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "type", "TRANSFERRED",
                        "occurredAt", "2026-04-26T10:05:00Z",
                        "notes", "Transferencia offline",
                        "performedByUserId", UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a").toString(),
                        "sourceChannel", "OFFLINE",
                        "operationId", operationId.toString(),
                        "metadata", Map.of(
                                "fromOwnerGanaderoId", DEFAULT_OWNER_GANADERO_ID.toString(),
                                "toOwnerGanaderoId", targetOwnerId.toString())),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(request, UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));
        PushSyncResponse replayResponse = syncService.push(request, UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));

        Animal projected = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(animalUuid).orElseThrow());

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals("no_conflict", replayResponse.results().getFirst().classification());
        assertEquals(1, animalEventRepository.count());
        assertEquals(targetOwnerId, projected.getOwnerGanadero().getId());
    }

    @Test
    void shouldRejectAnimalEventTypesOutsideV1Catalog() {
        UUID animalUuid = UUID.fromString("02dddca7-7f48-4d12-8691-e8ba994f7c0f");
        UUID operationId = UUID.fromString("13aee643-a465-4dc6-b50c-534e41e7453a");
        seedAnimal(animalUuid, "BO-1600", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));

        PushSyncRequest request = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.ANIMAL_EVENT,
                operationId.toString(),
                SyncOperationType.CREATE,
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "type", "SANITARY",
                        "occurredAt", "2026-04-26T10:05:00Z",
                        "notes", "Fuera de catálogo",
                        "performedByUserId", UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a").toString(),
                        "sourceChannel", "OFFLINE",
                        "operationId", operationId.toString(),
                        "metadata", Map.of()),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncResponse response = syncService.push(request, UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));

        assertEquals("validation_error", response.results().getFirst().classification());
        assertEquals("ANIMAL_EVENT_TYPE_INVALID", response.results().getFirst().conflict().reason());
    }

    @Test
    void shouldPullNotificationItemsIncrementallyForTheCurrentRecipientOnly() {
        UUID adminId = UUID.fromString("819be3db-0ab6-4f87-8bb4-b0920a1f97b8");
        UUID recipientId = UUID.fromString("3a7bf36a-b4d5-44dc-bf1f-c9a2d0c286ca");
        UUID otherRecipientId = UUID.fromString("aa631974-9389-4d30-84b0-4d5b9744a2f4");
        seedUser(adminId, "admin-sync-notif", "admin-sync-notif@hato.bo", Role.ADMIN, UserStatus.ACTIVE, 0L, LocalDateTime.of(2026, 4, 26, 8, 0));
        seedUser(recipientId, "ganadero-sync-a", "ganadero-sync-a@hato.bo", Role.GANADERO, UserStatus.ACTIVE, 0L, LocalDateTime.of(2026, 4, 26, 8, 1));
        seedUser(otherRecipientId, "ganadero-sync-b", "ganadero-sync-b@hato.bo", Role.GANADERO, UserStatus.ACTIVE, 0L, LocalDateTime.of(2026, 4, 26, 8, 2));

        adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Aviso para A",
                        "Solo llega a A.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(recipientId),
                        List.of()),
                UUID.fromString("9d52e847-2a60-41fc-904e-d6b82380b9dd"),
                adminId);
        adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Aviso para B",
                        "Solo llega a B.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(otherRecipientId),
                        List.of()),
                UUID.fromString("7808258a-f797-4345-b1df-6679524c14f0"),
                adminId);

        PullSyncResponse response = syncService.pull(
                SyncEntityType.NOTIFICATION,
                OffsetDateTime.of(2026, 4, 26, 7, 59, 0, 0, ZoneOffset.UTC),
                "00000000-0000-0000-0000-000000000001",
                recipientId);

        assertEquals(1, response.items().size());
        assertEquals("Aviso para A", response.items().getFirst().get("title"));
        assertEquals("Solo llega a A.", response.items().getFirst().get("body"));
    }

    @Test
    void shouldReturnStableEmptyNotificationDeltaWhenThereAreNoChanges() {
        UUID recipientId = UUID.fromString("d447d7c9-0916-427b-806e-cf664066ff9f");
        seedUser(
                recipientId,
                "ganadero-sync-stable",
                "ganadero-sync-stable@hato.bo",
                Role.GANADERO,
                UserStatus.ACTIVE,
                0L,
                LocalDateTime.of(2026, 4, 26, 8, 1));

        OffsetDateTime cursorUpdatedAt = OffsetDateTime.of(2026, 4, 26, 8, 30, 0, 0, ZoneOffset.UTC);
        String cursorId = "notification-cursor-stable";

        PullSyncResponse response = syncService.pull(SyncEntityType.NOTIFICATION, cursorUpdatedAt, cursorId, recipientId);

        assertEquals(0, response.items().size());
        assertEquals(cursorUpdatedAt, response.nextCursor().cursorUpdatedAt());
        assertEquals(cursorId, response.nextCursor().cursorId());
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

    @Test
    void shouldExposeV2PolicyDiffAndAllowedActionsForAnimalConflict() {
        UUID animalUuid = UUID.fromString("f7ad742e-f1ec-422e-99cd-f4dd164f5088");
        seedAnimal(animalUuid, "BO-4010", 3L, LocalDateTime.of(2026, 4, 28, 10, 0));

        PushSyncResponse response = syncService.push(
                new PushSyncRequest(List.of(new SyncOperationRequest(
                        UUID.fromString("7f755ea9-3628-4fe7-9cf6-c80e5667857e"),
                        SyncEntityType.ANIMAL,
                        animalUuid.toString(),
                        SyncOperationType.UPDATE,
                        Map.of("tag", "BO-4011", "active", false),
                        1,
                        OffsetDateTime.parse("2026-04-28T10:05:00Z"),
                        OffsetDateTime.parse("2026-04-28T10:05:00Z")))),
                UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"),
                true);

        assertEquals("version_conflict", response.results().getFirst().classification());
        assertEquals("manual_resolution", response.results().getFirst().conflict().resolutionHint());
        assertEquals("offline-conflict-resolution/v2/ANIMAL/UPDATE", response.results().getFirst().conflict().policyKey());
        assertEquals(List.of("accept_server", "retry_local", "discard_local"), response.results().getFirst().conflict().allowedActions());
        assertEquals(2, response.results().getFirst().conflict().diffFields().size());
        assertTrue(syncConflictAuditLedgerRepository.listByOperationId(response.results().getFirst().operationId()).stream()
                .anyMatch(entry -> "DETECTED".equals(entry.getEventType())));
    }

    @Test
    void shouldResolveConflictWithRetryLocalAndKeepAuditAppendOnly() {
        UUID animalUuid = UUID.fromString("a63007e0-570d-4021-a493-25a6ca6c3128");
        UUID operationId = UUID.fromString("25a2c8a3-ae2d-46ea-8b1b-bfeff3204b3b");
        seedAnimal(animalUuid, "BO-4020", 4L, LocalDateTime.of(2026, 4, 28, 10, 0));

        syncService.push(
                new PushSyncRequest(List.of(new SyncOperationRequest(
                        operationId,
                        SyncEntityType.ANIMAL,
                        animalUuid.toString(),
                        SyncOperationType.UPDATE,
                        Map.of("tag", "BO-4021"),
                        2,
                        OffsetDateTime.parse("2026-04-28T10:05:00Z"),
                        OffsetDateTime.parse("2026-04-28T10:05:00Z")))),
                UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"),
                true);

        var response = syncService.resolveConflict(
                operationId,
                new ResolveConflictRequest("retry_local", "Reintentamos el payload original sin editarlo."),
                UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));

        assertEquals("resolved", response.status());
        assertEquals("pending", response.nextLocalStatus());
        assertEquals(2, syncConflictAuditLedgerRepository.listByOperationId(operationId).size());
        assertEquals("RESOLVED", syncConflictAuditLedgerRepository.listByOperationId(operationId).getLast().getEventType());
    }

    @Test
    void shouldRejectConflictResolutionFromDifferentAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("44444444-5555-4666-8777-888888888888");
        UUID operationId = UUID.fromString("99999999-0000-4111-8222-333333333333");
        UUID actorId = UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a");
        UUID anotherUserId = UUID.fromString("ca25845f-69d4-4af0-9078-93040319401a");
        seedAnimal(animalUuid, "BO-OWN-1", 4L, LocalDateTime.of(2026, 4, 28, 10, 0));

        syncService.push(
                new PushSyncRequest(List.of(new SyncOperationRequest(
                        operationId,
                        SyncEntityType.ANIMAL,
                        animalUuid.toString(),
                        SyncOperationType.UPDATE,
                        Map.of("tag", "BO-OWN-2"),
                        2,
                        OffsetDateTime.parse("2026-04-28T10:05:00Z"),
                        OffsetDateTime.parse("2026-04-28T10:05:00Z")))),
                actorId,
                true);

        BusinessException exception = assertThrows(BusinessException.class, () -> syncService.resolveConflict(
                operationId,
                new ResolveConflictRequest("retry_local", "Otro usuario intenta resolver un conflicto ajeno."),
                anotherUserId));

        assertEquals("SYNC_CONFLICT_FORBIDDEN", exception.code());
    }

    @Test
    @DisplayName("[stress] should append repeated conflict audit events for the same operation after retry_local replay")
    void shouldAppendRepeatedConflictAuditEventsAfterRetryLocalReplay() {
        UUID animalUuid = UUID.fromString("55555555-5555-4555-8555-555555555555");
        UUID operationId = UUID.fromString("66666666-6666-4666-8666-666666666666");
        UUID actorId = SyncHarnessFixtures.DEFAULT_ACTOR_USER_ID;
        fixtures.seedAnimal(animalUuid, "BO-CONFLICT-1", 4L, LocalDateTime.of(2026, 4, 28, 10, 0));
        PushSyncRequest request = fixtures.pushRequest(fixtures.animalUpdate(operationId, animalUuid, "BO-CONFLICT-2", 2, "2026-04-28T10:05:00Z"));

        PushSyncResponse firstResponse = syncService.push(request, actorId, true);
        syncService.resolveConflict(operationId, new ResolveConflictRequest("retry_local", "Reintentamos el payload original."), actorId);
        PushSyncResponse replayResponse = syncService.push(request, actorId, true);

        assertEquals("version_conflict", firstResponse.results().getFirst().classification());
        assertEquals("version_conflict", replayResponse.results().getFirst().classification());
        assertEquals(List.of("DETECTED", "RESOLVED", "DETECTED"),
                syncConflictAuditLedgerRepository.listByOperationId(operationId).stream().map(entry -> entry.getEventType()).toList());
    }

    @Test
    void shouldRejectManualResolutionActionExcludedByPolicy() {
        UUID operationId = UUID.fromString("81f79be8-61d7-455c-a062-31f7f8ffbb89");
        UUID animalUuid = UUID.fromString("9a7214e1-f6b0-43ea-bf3f-966656f81bf0");

        PushSyncResponse response = syncService.push(
                new PushSyncRequest(List.of(new SyncOperationRequest(
                        operationId,
                        SyncEntityType.ANIMAL_IMAGE,
                        operationId.toString(),
                        SyncOperationType.CREATE,
                        Map.of(
                                "animalUuid", animalUuid.toString(),
                                "operationId", operationId.toString(),
                                "mimeType", "image/jpeg",
                                "fileName", "conflict.jpg",
                                "sizeBytes", 4,
                                "checksumSha256", "invalid",
                                "base64Data", "aG9sYQ==",
                                "capturedAt", "2026-04-28T10:05:00Z",
                                "sourceChannel", "OFFLINE"),
                        0,
                        OffsetDateTime.parse("2026-04-28T10:05:00Z"),
                        OffsetDateTime.parse("2026-04-28T10:05:00Z")))),
                UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"),
                true);

        assertEquals("validation_error", response.results().getFirst().classification());
        assertEquals(List.of("discard_local"), response.results().getFirst().conflict().allowedActions());
    }

    @Test
    void shouldCreateAnimalOfflineUsingCanonicalUuidAndAcknowledgeReplayIdempotently() {
        UUID animalUuid = UUID.fromString("833ba3c7-59b8-484a-bdb7-4dbdb647f9c3");
        UUID operationId = UUID.fromString("a17121b4-1408-4f0a-850e-19b95beefb15");
        PushSyncRequest createRequest = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.ANIMAL,
                animalUuid.toString(),
                SyncOperationType.CREATE,
                Map.of(
                        "ownerGanaderoId", DEFAULT_OWNER_GANADERO_ID.toString(),
                        "arete", " AR-500 ",
                        "marca", "Marca Norte",
                        "category", "HEIFER",
                        "active", true,
                        "admissionDate", "2026-04-20",
                        "weightKg", 380.5),
                0,
                OffsetDateTime.parse("2026-04-26T12:05:00Z"),
                OffsetDateTime.parse("2026-04-26T12:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(createRequest);
        PushSyncResponse replayResponse = syncService.push(createRequest);

        Animal persisted = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(animalUuid).orElseThrow());

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals(animalUuid.toString(), firstResponse.results().getFirst().entityId());
        assertEquals(firstResponse.results().getFirst().entityId(), replayResponse.results().getFirst().entityId());
        assertEquals(firstResponse.results().getFirst().serverVersion(), replayResponse.results().getFirst().serverVersion());
        assertEquals(animalUuid, persisted.getUuid());
        assertEquals(DEFAULT_OWNER_GANADERO_ID, persisted.getOwnerGanadero().getId());
        assertEquals("AR-500", persisted.getArete());
        assertEquals("ar-500", persisted.getAreteNormalized());
        assertEquals("Marca Norte", persisted.getMarca());
        assertEquals(1, animalRepository.count());
    }

    @Test
    void shouldExposeOfflineCapabilityMatrixForFoundationEntities() {
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.USER, SyncOperationType.STATUS_UPDATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.GANADERO, SyncOperationType.CREATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.GANADERO, SyncOperationType.STATUS_UPDATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.ANIMAL, SyncOperationType.CREATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.ANIMAL, SyncOperationType.UPDATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.ANIMAL_EVENT, SyncOperationType.CREATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.ANIMAL_HEALTH_EVENT, SyncOperationType.CREATE));
        assertEquals(true, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.ANIMAL_IMAGE, SyncOperationType.CREATE));

        assertEquals(false, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.USER, SyncOperationType.CREATE));
        assertEquals(false, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.USER, SyncOperationType.PASSWORD_RESET));
        assertEquals(false, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.GANADERO, SyncOperationType.DELETE));
        assertEquals(false, syncPayloadMapper.isOfflineOperationAllowed(SyncEntityType.ANIMAL, SyncOperationType.STATUS_UPDATE));
    }

    @Test
    void shouldPullAnimalEventItemsIncrementally() {
        UUID animalUuid = UUID.fromString("583da4dc-2f09-4820-b0f3-762738d5c6ca");
        UUID operationId = UUID.fromString("089ea427-af0d-4035-ac27-cbca2130f4ca");
        seedAnimal(animalUuid, "BO-1700", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));
        seedAnimalEvent(animalUuid, operationId, AnimalEventType.LOST, LocalDateTime.of(2026, 4, 26, 12, 0));

        PullSyncResponse response = syncService.pull(
                SyncEntityType.ANIMAL_EVENT,
                OffsetDateTime.of(2026, 4, 26, 11, 0, 0, 0, ZoneOffset.UTC),
                "00000000-0000-0000-0000-000000000001");

        assertEquals(1, response.items().size());
        assertEquals(operationId.toString(), response.items().getFirst().get("id"));
        assertEquals(animalUuid.toString(), response.items().getFirst().get("animalUuid"));
        assertEquals("LOST", response.items().getFirst().get("type"));
    }

    @Test
    void shouldRejectOperationsOutsideOfflineCapabilityMatrixWithExplicitReason() {
        PushSyncResponse response = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("f5875cd8-ac43-4bf3-b8e5-2be463bb42cc"),
                SyncEntityType.USER,
                UUID.fromString("f1471ac5-dfcd-4287-a177-72a6f84f2eb8").toString(),
                SyncOperationType.CREATE,
                Map.of("username", "offline-admin"),
                0,
                OffsetDateTime.parse("2026-04-26T13:00:00Z"),
                OffsetDateTime.parse("2026-04-26T13:00:00Z")))));

        assertEquals("validation_error", response.results().getFirst().classification());
        assertEquals("OPERATION_NOT_ALLOWED_OFFLINE", response.results().getFirst().conflict().reason());
        assertEquals("manual_refresh", response.results().getFirst().conflict().resolutionHint());
    }

    @Test
    void shouldCreateAnimalHealthEventOfflineIdempotentlyAndPullIncrementally() {
        UUID animalUuid = UUID.fromString("ce9c5754-2518-49c4-b6a5-dd609bf2a7ca");
        UUID operationId = UUID.fromString("0630f95c-0bab-4ec7-b11d-49f6450f47d1");
        UUID actorId = UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a");
        seedAnimal(animalUuid, "BO-HEALTH-1", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));

        PushSyncRequest request = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.ANIMAL_HEALTH_EVENT,
                operationId.toString(),
                SyncOperationType.CREATE,
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "healthEventType", "TREATMENT_STARTED",
                        "occurredAt", "2026-04-26T10:05:00Z",
                        "notes", "Inicio tratamiento respiratorio",
                        "performedByUserId", actorId.toString(),
                        "sourceChannel", "OFFLINE",
                        "operationId", operationId.toString(),
                        "metadata", Map.of("treatmentCaseId", "CASE-100", "productName", "Oxitetraciclina")),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(request, actorId);
        PushSyncResponse replayResponse = syncService.push(request, actorId);
        PullSyncResponse pullResponse = syncService.pull(
                SyncEntityType.ANIMAL_HEALTH_EVENT,
                OffsetDateTime.of(2026, 4, 26, 10, 0, 0, 0, ZoneOffset.UTC),
                "00000000-0000-0000-0000-000000000001");

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals("no_conflict", replayResponse.results().getFirst().classification());
        assertEquals(1, animalHealthEventRepository.count());
        assertEquals("TREATMENT_STARTED", pullResponse.items().getFirst().get("healthEventType"));
    }

    @Test
    void shouldRejectAnimalHealthEventsWithoutPayloadOperationId() {
        UUID animalUuid = UUID.fromString("5528b8fc-9d84-439f-82ea-ef9db46866f2");
        UUID actorId = UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a");
        seedAnimal(animalUuid, "BO-HEALTH-2", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));

        PushSyncResponse response = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("dbd5172f-b9b0-42db-8211-d9316b68cd74"),
                SyncEntityType.ANIMAL_HEALTH_EVENT,
                "pending-health-1",
                SyncOperationType.CREATE,
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "healthEventType", "VACCINATION",
                        "occurredAt", "2026-04-26T10:05:00Z",
                        "notes", "Vacuna anual",
                        "performedByUserId", actorId.toString(),
                        "sourceChannel", "OFFLINE",
                        "metadata", Map.of("productName", "Brucelosis")),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z")))), actorId);

        assertEquals("validation_error", response.results().getFirst().classification());
        assertEquals("ANIMAL_HEALTH_EVENT_OPERATION_ID_REQUIRED", response.results().getFirst().conflict().reason());
    }

    @Test
    void shouldSyncUserStatusUpdateIdempotentlyAndExposeIncrementalUserPull() {
        UUID actorId = UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a");
        UUID firstUserId = UUID.fromString("5627d9c2-43d6-4694-8eb4-8c218fc7d454");
        UUID secondUserId = UUID.fromString("89aa41d6-4f9e-4fa1-b136-b8cf4bc8a20f");
        UUID operationId = UUID.fromString("eff4f7eb-5f52-4a13-a783-d58d0f7c6ed0");

        seedUser(firstUserId, "campo-1", "campo-1@hato.bo", UserStatus.ACTIVE, 0L, LocalDateTime.of(2026, 4, 26, 9, 0));
        seedUser(secondUserId, "campo-2", "campo-2@hato.bo", UserStatus.INACTIVE, 3L, LocalDateTime.of(2026, 4, 26, 12, 0));

        PushSyncRequest request = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.USER,
                firstUserId.toString(),
                SyncOperationType.STATUS_UPDATE,
                Map.of("status", "INACTIVE"),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(request, actorId);
        PushSyncResponse replayResponse = syncService.push(request, actorId);
        User persisted = QuarkusTransaction.requiringNew().call(() -> userRepository.findByIdOptional(firstUserId).orElseThrow());
        PullSyncResponse pullResponse = syncService.pull(
                SyncEntityType.USER,
                OffsetDateTime.of(2026, 4, 26, 10, 0, 0, 0, ZoneOffset.UTC),
                UUID.fromString("11111111-1111-1111-1111-111111111111").toString());

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals("no_conflict", replayResponse.results().getFirst().classification());
        assertEquals(firstResponse.results().getFirst().serverVersion(), replayResponse.results().getFirst().serverVersion());
        assertEquals(UserStatus.INACTIVE, persisted.getStatus());
        assertEquals(1, operationLogRepository.count());
        assertEquals(2, pullResponse.items().size());
        assertEquals(secondUserId.toString(), pullResponse.items().getFirst().get("id"));
        assertEquals(firstUserId.toString(), pullResponse.items().get(1).get("id"));
        assertEquals("INACTIVE", pullResponse.items().get(1).get("status"));
        assertEquals(firstUserId.toString(), pullResponse.nextCursor().cursorId());
    }

    @Test
    void shouldReturnUserVersionConflictWithServerState() {
        UUID userId = UUID.fromString("745efd0e-8101-4555-9310-2b9a885b6316");
        seedUser(userId, "campo-conflict", "campo-conflict@hato.bo", UserStatus.ACTIVE, 2L, LocalDateTime.of(2026, 4, 26, 11, 0));

        PushSyncResponse response = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("4752165e-bab1-42c5-a124-c446194bb3c9"),
                SyncEntityType.USER,
                userId.toString(),
                SyncOperationType.STATUS_UPDATE,
                Map.of("status", "INACTIVE"),
                1,
                OffsetDateTime.parse("2026-04-26T11:05:00Z"),
                OffsetDateTime.parse("2026-04-26T11:05:00Z")))));

        assertEquals("version_conflict", response.results().getFirst().classification());
        assertEquals(2, response.results().getFirst().serverVersion());
        assertEquals("manual_refresh", response.results().getFirst().conflict().resolutionHint());
        assertInstanceOf(Map.class, response.results().getFirst().conflict().serverState());
    }

    @Test
    void shouldCreateGanaderoUsingOperationIdAsStableIdentityAndPullIncrementally() {
        UUID actorId = UUID.fromString("d65e0ea4-340c-4fd6-a5d0-f469f9c88b4a");
        UUID operationId = UUID.fromString("33ad9817-da1f-406c-8cca-b8dcc3ba9d71");
        UUID laterGanaderoId = UUID.fromString("cdfd9e10-0b58-4d8d-a6f4-52f6b63c3c3b");

        seedGanadero(laterGanaderoId, "NIT-999", "Ganadera Posterior", true, 4L, LocalDateTime.of(2026, 4, 26, 13, 0));

        PushSyncRequest createRequest = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.GANADERO,
                "pending:ganadero-create-1",
                SyncOperationType.CREATE,
                Map.of("businessIdentifier", "NIT-500", "name", "Ganadera Offline"),
                0,
                OffsetDateTime.parse("2026-04-26T12:05:00Z"),
                OffsetDateTime.parse("2026-04-26T12:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(createRequest, actorId);
        PushSyncResponse replayResponse = syncService.push(createRequest, actorId);
        Ganadero created = QuarkusTransaction.requiringNew().call(() -> ganaderoRepository.findByIdOptional(operationId).orElseThrow());
        PullSyncResponse pullResponse = syncService.pull(
                SyncEntityType.GANADERO,
                OffsetDateTime.of(2026, 4, 26, 12, 30, 0, 0, ZoneOffset.UTC),
                UUID.fromString("11111111-1111-1111-1111-111111111111").toString());

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals(operationId.toString(), firstResponse.results().getFirst().entityId());
        assertEquals(firstResponse.results().getFirst().entityId(), replayResponse.results().getFirst().entityId());
        assertEquals(operationId, created.getId());
        assertEquals("NIT-500", created.getBusinessIdentifier());
        assertEquals(1, operationLogRepository.count());
        assertEquals(2, pullResponse.items().size());
        assertEquals(laterGanaderoId.toString(), pullResponse.items().getFirst().get("id"));
        assertEquals(operationId.toString(), pullResponse.items().get(1).get("id"));
        assertEquals(operationId.toString(), pullResponse.nextCursor().cursorId());
    }

    @Test
    void shouldPullAnimalHealthEventsOnFirstSyncWithoutCursor() {
        UUID animalUuid = UUID.fromString("4ec9e24e-38f5-46d8-8d3d-e36083c0a829");
        UUID operationId = UUID.fromString("cc05998f-7660-4fcb-a42f-b6430fa10309");
        seedAnimal(animalUuid, "BO-HEALTH-2", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));
        seedAnimalHealthEvent(
                animalUuid,
                operationId,
                AnimalHealthEventType.VACCINATION,
                LocalDateTime.of(2026, 4, 26, 10, 15));

        PullSyncResponse response = syncService.pull(SyncEntityType.ANIMAL_HEALTH_EVENT, null, null);

        assertEquals(1, response.items().size());
        assertEquals(operationId.toString(), response.items().getFirst().get("operationId"));
        assertEquals(animalUuid.toString(), response.items().getFirst().get("animalUuid"));
        assertNotNull(response.nextCursor().cursorId());
        assertNotNull(response.nextCursor().cursorUpdatedAt());
    }

    @Test
    void shouldSyncGanaderoStatusUpdateAndReturnVersionConflictWhenBaseVersionIsStale() {
        UUID ganaderoId = UUID.fromString("18f25f31-a7da-4d7f-8c5d-78d17e3c778f");
        seedGanadero(ganaderoId, "NIT-777", "Ganadera Serrana", true, 2L, LocalDateTime.of(2026, 4, 26, 11, 0));

        PushSyncResponse okResponse = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("4f887d15-9bcc-4357-8d6c-0b5284fe19ea"),
                SyncEntityType.GANADERO,
                ganaderoId.toString(),
                SyncOperationType.STATUS_UPDATE,
                Map.of("active", false),
                2,
                OffsetDateTime.parse("2026-04-26T11:05:00Z"),
                OffsetDateTime.parse("2026-04-26T11:05:00Z")))));

        PushSyncResponse conflictResponse = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("2554f1f6-1e57-43b7-b01a-e0d0b900c0ee"),
                SyncEntityType.GANADERO,
                ganaderoId.toString(),
                SyncOperationType.STATUS_UPDATE,
                Map.of("active", true),
                1,
                OffsetDateTime.parse("2026-04-26T11:10:00Z"),
                OffsetDateTime.parse("2026-04-26T11:10:00Z")))));

        Ganadero persisted = QuarkusTransaction.requiringNew().call(() -> ganaderoRepository.findByIdOptional(ganaderoId).orElseThrow());

        assertEquals("no_conflict", okResponse.results().getFirst().classification());
        assertEquals(false, persisted.isActive());
        assertEquals("version_conflict", conflictResponse.results().getFirst().classification());
        assertEquals(3, conflictResponse.results().getFirst().serverVersion());
        assertInstanceOf(Map.class, conflictResponse.results().getFirst().conflict().serverState());
    }

    @Test
    void shouldCreateAnimalReproductionEventOfflineIdempotentlyAndPullIncrementally() {
        UUID motherUuid = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        UUID calfUuid = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        UUID operationId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        UUID actorId = UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a");
        seedAnimal(motherUuid, "BO-REPRO-1", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));
        seedAnimal(calfUuid, "BO-CALF-1", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));

        PushSyncRequest request = new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                operationId,
                SyncEntityType.ANIMAL_REPRODUCTION_EVENT,
                operationId.toString(),
                SyncOperationType.CREATE,
                Map.of(
                        "animalUuid", motherUuid.toString(),
                        "reproductionEventType", "BIRTH",
                        "occurredAt", "2026-04-26T10:05:00Z",
                        "notes", "Parto offline",
                        "performedByUserId", actorId.toString(),
                        "sourceChannel", "OFFLINE",
                        "operationId", operationId.toString(),
                        "metadata", Map.of(
                                "birthDate", "2026-04-26T10:05:00Z",
                                "offspringCount", 1,
                                "motherAnimalUuid", motherUuid.toString(),
                                "offspringAnimalUuids", java.util.List.of(calfUuid.toString()))),
                0,
                OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                OffsetDateTime.parse("2026-04-26T10:05:00Z"))));

        PushSyncResponse firstResponse = syncService.push(request, actorId);
        PushSyncResponse replayResponse = syncService.push(request, actorId);
        PullSyncResponse pullResponse = syncService.pull(
                SyncEntityType.ANIMAL_REPRODUCTION_EVENT,
                OffsetDateTime.of(2026, 4, 26, 10, 0, 0, 0, ZoneOffset.UTC),
                "00000000-0000-0000-0000-000000000001");
        Animal calf = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(calfUuid).orElseThrow());

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals("no_conflict", replayResponse.results().getFirst().classification());
        assertEquals(1, animalReproductionEventRepository.count());
        assertEquals("BIRTH", pullResponse.items().getFirst().get("reproductionEventType"));
        assertEquals(motherUuid, calf.getMotherAnimalUuid());
    }

    @Test
    void shouldCreateAnimalImageOfflineIdempotentlyAndKeepOtherEntityTypesFlowingOnPartialAck() {
        UUID animalUuid = UUID.fromString("de9c5754-2518-49c4-b6a5-dd609bf2a7ca");
        UUID imageOperationId = UUID.fromString("1630f95c-0bab-4ec7-b11d-49f6450f47d1");
        UUID eventOperationId = UUID.fromString("2630f95c-0bab-4ec7-b11d-49f6450f47d1");
        seedAnimal(animalUuid, "BO-IMAGE-1", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));
        byte[] validContent = "valid-image".getBytes();
        byte[] invalidContent = "invalid-image".getBytes();

        PushSyncRequest request = new PushSyncRequest(java.util.List.of(
                new SyncOperationRequest(
                        imageOperationId,
                        SyncEntityType.ANIMAL_IMAGE,
                        imageOperationId.toString(),
                        SyncOperationType.CREATE,
                        Map.of(
                                "animalUuid", animalUuid.toString(),
                                "operationId", imageOperationId.toString(),
                                "mimeType", "image/jpeg",
                                "fileName", "vaca.jpg",
                                "sizeBytes", validContent.length,
                                "checksumSha256", AnimalImageSecuritySupport.sha256Hex(validContent),
                                "base64Data", java.util.Base64.getEncoder().encodeToString(validContent),
                                "capturedAt", "2026-04-26T10:05:00Z",
                                "sourceChannel", "OFFLINE"),
                        0,
                        OffsetDateTime.parse("2026-04-26T10:05:00Z"),
                        OffsetDateTime.parse("2026-04-26T10:05:00Z")),
                new SyncOperationRequest(
                        eventOperationId,
                        SyncEntityType.ANIMAL_IMAGE,
                        eventOperationId.toString(),
                        SyncOperationType.CREATE,
                        Map.of(
                                "animalUuid", animalUuid.toString(),
                                "operationId", eventOperationId.toString(),
                                "mimeType", "image/webp",
                                "fileName", "vaca.webp",
                                "sizeBytes", invalidContent.length,
                                "checksumSha256", AnimalImageSecuritySupport.sha256Hex(invalidContent),
                                "base64Data", java.util.Base64.getEncoder().encodeToString(invalidContent),
                                "capturedAt", "2026-04-26T10:06:00Z",
                                "sourceChannel", "OFFLINE"),
                        0,
                        OffsetDateTime.parse("2026-04-26T10:06:00Z"),
                        OffsetDateTime.parse("2026-04-26T10:06:00Z"))));

        PushSyncResponse firstResponse = syncService.push(request);
        PushSyncResponse replayResponse = syncService.push(request);
        PullSyncResponse pullResponse = syncService.pull(
                SyncEntityType.ANIMAL_IMAGE,
                OffsetDateTime.of(2026, 4, 26, 10, 0, 0, 0, ZoneOffset.UTC),
                "00000000-0000-0000-0000-000000000001");

        assertEquals("no_conflict", firstResponse.results().getFirst().classification());
        assertEquals("validation_error", firstResponse.results().get(1).classification());
        assertEquals("no_conflict", replayResponse.results().getFirst().classification());
        assertEquals(1, animalImageRepository.count());
        assertEquals(1, pullResponse.items().size());
        assertEquals(imageOperationId.toString(), pullResponse.items().getFirst().get("operationId"));
    }

    @Test
    void shouldPullAnimalReproductionEventsOnFirstSyncWithoutCursor() {
        UUID animalUuid = UUID.fromString("4ec9e24e-38f5-46d8-8d3d-e36083c0a830");
        UUID operationId = UUID.fromString("cc05998f-7660-4fcb-a42f-b6430fa10310");
        seedAnimal(animalUuid, "BO-REPRO-2", 0L, LocalDateTime.of(2026, 4, 26, 10, 0));
        seedAnimalReproductionEvent(
                animalUuid,
                operationId,
                AnimalReproductionEventType.SERVICE,
                LocalDateTime.of(2026, 4, 26, 10, 15));

        PullSyncResponse response = syncService.pull(SyncEntityType.ANIMAL_REPRODUCTION_EVENT, null, null);

        assertEquals(1, response.items().size());
        assertEquals(operationId.toString(), response.items().getFirst().get("operationId"));
        assertEquals(animalUuid.toString(), response.items().getFirst().get("animalUuid"));
        assertNotNull(response.nextCursor().cursorId());
        assertNotNull(response.nextCursor().cursorUpdatedAt());
    }

    @Test
    void shouldResolveObservabilityWindowDefaultsAndRejectInvalidValues() {
        assertEquals("24h", syncService.resolveObservabilityWindow(null));
        assertEquals("24h", syncService.resolveObservabilityWindow(""));
        assertEquals("7d", syncService.resolveObservabilityWindow("7d"));
        assertThrows(RuntimeException.class, () -> syncService.resolveObservabilityWindow("30d"));
    }

    @Test
    void shouldAggregateSyncObservabilityWithDictionaryRecentLimitAndEntityHealth() {
        UUID replayConflictOperationId = UUID.fromString("11111111-2222-3333-4444-555555555555");
        UUID validationOperationId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        seedAnimal(UUID.fromString("12345678-1234-1234-1234-123456789012"), "BO-OBS-1", 0L, LocalDateTime.now().minusHours(1));

        QuarkusTransaction.requiringNew().run(() -> {
            var conflictReceipt = new bo.pasorapa.hato.domain.SyncOperationReceipt();
            conflictReceipt.setOperationId(replayConflictOperationId);
            conflictReceipt.setEntityType("ANIMAL");
            conflictReceipt.setEntityId("animal-1");
            conflictReceipt.setOperationType("UPDATE");
            conflictReceipt.setClassification("version_conflict");
            conflictReceipt.setReason("VERSION_CONFLICT");
            conflictReceipt.setCreatedAt(LocalDateTime.now().minusHours(2));
            syncOperationReceiptRepository.persist(conflictReceipt);

            var validationReceipt = new bo.pasorapa.hato.domain.SyncOperationReceipt();
            validationReceipt.setOperationId(validationOperationId);
            validationReceipt.setEntityType("GANADERO");
            validationReceipt.setEntityId("ganadero-1");
            validationReceipt.setOperationType("CREATE");
            validationReceipt.setClassification("validation_error");
            validationReceipt.setReason("VALIDATION_ERROR");
            validationReceipt.setCreatedAt(LocalDateTime.now().minusHours(1));
            syncOperationReceiptRepository.persist(validationReceipt);

            var ledger = new bo.pasorapa.hato.domain.SyncConflictAuditLedger();
            ledger.setOperationId(replayConflictOperationId);
            ledger.setEntityType("ANIMAL");
            ledger.setEntityId("animal-1");
            ledger.setOperationType("UPDATE");
            ledger.setEventType("DETECTED");
            ledger.setReason("VERSION_CONFLICT");
            ledger.setPolicyKey("offline-conflict-resolution/v2/ANIMAL/UPDATE");
            ledger.setRetentionExpiresAt(LocalDateTime.now().plusDays(365));
            ledger.setCreatedAt(LocalDateTime.now().minusHours(2));
            syncConflictAuditLedgerRepository.persist(ledger);
        });

        var response = syncService.getObservability("24h");

        assertEquals("24h", response.window());
        assertEquals(5, response.dictionary().size());
        assertEquals(2L, response.totals().get("totalReceipts"));
        assertEquals(1L, response.conflicts().open());
        assertEquals(1L, response.conflicts().blockedOperations());
        assertTrue(response.byEntity().containsKey("ANIMAL"));
        assertTrue(response.entityHealth().containsKey("ANIMAL"));
        assertTrue(response.recentIssues().size() <= 20);
    }

    private void seedAnimal(UUID uuid, String tag, Long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setCode("CODE-" + tag);
            animal.setTag(tag);
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(DEFAULT_OWNER_GANADERO_ID).orElseThrow());
            animal.setArete(tag);
            animal.setAreteNormalized(tag.trim().toLowerCase());
            animal.setMarca("CODE-" + tag);
            animal.setMarcaNormalized(("CODE-" + tag).toLowerCase());
            animal.setUuid(uuid);
            animal.setVersion(version);
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 10));
            animal.setWeightKg(new BigDecimal("420.50"));
            animal.setCreatedAt(updatedAt.minusDays(1));
            animal.setUpdatedAt(updatedAt);
            animalRepository.persist(animal);
        });
    }

    private void seedAnimalEvent(UUID animalUuid, UUID operationId, AnimalEventType type, LocalDateTime occurredAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnimalEvent event = new AnimalEvent();
            event.setEventId(UUID.randomUUID());
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setType(type);
            event.setOccurredAt(occurredAt);
            event.setClientCreatedAt(occurredAt.plusMinutes(1));
            event.setNotes("Event " + type);
            event.setPerformedByUserId(UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));
            event.setSourceChannel("OFFLINE");
            event.setOperationId(operationId);
            event.setMetadataJson("{\"reasonCode\":\"NOTE\"}");
            event.setCreatedAt(occurredAt.plusMinutes(2));
            event.setUpdatedAt(occurredAt.plusMinutes(2));
            animalEventRepository.persist(event);
        });
    }

    private void seedAnimalHealthEvent(UUID animalUuid, UUID operationId, AnimalHealthEventType type, LocalDateTime occurredAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnimalHealthEvent event = new AnimalHealthEvent();
            event.setEventId(UUID.randomUUID());
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setHealthEventType(type);
            event.setOccurredAt(occurredAt);
            event.setClientCreatedAt(occurredAt.plusMinutes(1));
            event.setNotes("Health event " + type);
            event.setPerformedByUserId(UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));
            event.setSourceChannel("OFFLINE");
            event.setOperationId(operationId);
            event.setMetadataJson("{\"productName\":\"Brucelosis\"}");
            event.setCreatedAt(occurredAt.plusMinutes(2));
            event.setUpdatedAt(occurredAt.plusMinutes(2));
            animalHealthEventRepository.persist(event);
        });
    }

    private void seedAnimalReproductionEvent(UUID animalUuid, UUID operationId, AnimalReproductionEventType type, LocalDateTime occurredAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnimalReproductionEvent event = new AnimalReproductionEvent();
            event.setEventId(UUID.randomUUID());
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setReproductionEventType(type);
            event.setOccurredAt(occurredAt);
            event.setClientCreatedAt(occurredAt.plusMinutes(1));
            event.setNotes("Reproduction event " + type);
            event.setPerformedByUserId(UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a"));
            event.setSourceChannel("OFFLINE");
            event.setOperationId(operationId);
            event.setMetadataJson(type == AnimalReproductionEventType.SERVICE
                    ? "{\"serviceMethod\":\"NATURAL\"}"
                    : "{\"birthDate\":\"2026-04-26T10:15:00Z\",\"offspringCount\":0,\"motherAnimalUuid\":\"" + animalUuid + "\"}");
            event.setCreatedAt(occurredAt.plusMinutes(2));
            event.setUpdatedAt(occurredAt.plusMinutes(2));
            animalReproductionEventRepository.persist(event);
        });
    }

    private void seedGanadero(UUID id, String businessIdentifier, String name, Long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganadero = new Ganadero();
            ganadero.setId(id);
            ganadero.setBusinessIdentifier(businessIdentifier);
            ganadero.setName(name);
            ganadero.setActive(true);
            ganaderoRepository.persist(ganadero);
            ganaderoRepository.flush();
            ganaderoRepository.getEntityManager()
                    .createNativeQuery("update ganaderos set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, version)
                    .setParameter(2, updatedAt.minusDays(1))
                    .setParameter(3, updatedAt)
                    .setParameter(4, id)
                    .executeUpdate();
        });
    }

    private void seedUser(UUID id, String username, String email, UserStatus status, Long version, LocalDateTime updatedAt) {
        seedUser(id, username, email, Role.GANADERO, status, version, updatedAt);
    }

    private void seedUser(UUID id, String username, String email, Role role, UserStatus status, Long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            User user = new User();
            user.setId(id);
            user.setUsername(username);
            user.setEmail(email);
            user.setDisplayName(username);
            user.setPasswordHash("hash");
            user.setRole(role);
            user.setStatus(status);
            userRepository.persist(user);
            userRepository.flush();
            userRepository.getEntityManager()
                    .createNativeQuery("update users set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, version)
                    .setParameter(2, updatedAt.minusDays(2))
                    .setParameter(3, updatedAt)
                    .setParameter(4, id)
                    .executeUpdate();
        });
    }

    private void seedGanadero(UUID id, String businessIdentifier, String name, boolean active, Long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganadero = new Ganadero();
            ganadero.setId(id);
            ganadero.setBusinessIdentifier(businessIdentifier);
            ganadero.setName(name);
            ganadero.setActive(active);
            ganaderoRepository.persist(ganadero);
            ganaderoRepository.flush();
            ganaderoRepository.getEntityManager()
                    .createNativeQuery("update ganaderos set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, version)
                    .setParameter(2, updatedAt.minusDays(2))
                    .setParameter(3, updatedAt)
                    .setParameter(4, id)
                    .executeUpdate();
        });
    }
}
