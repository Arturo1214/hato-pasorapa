package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.HerdCostLedger;
import bo.pasorapa.hato.domain.HerdLot;
import bo.pasorapa.hato.domain.HerdProductivityLedger;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.HerdCostLedgerRepository;
import bo.pasorapa.hato.repository.HerdLotAssignmentRepository;
import bo.pasorapa.hato.repository.HerdLotRepository;
import bo.pasorapa.hato.repository.HerdProductivityLedgerRepository;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationRequest;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
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
class SyncServiceV2Test {

    private static final UUID OWNER_ID = UUID.fromString("6c4ab5c9-c9df-4b06-a858-ecbda97453f9");
    private static final UUID LOT_ID = UUID.fromString("cccccccc-1111-4444-8888-000000000001");
    private static final UUID ANIMAL_ID = UUID.fromString("aaaaaaaa-1111-4444-8888-000000000001");

    @Inject
    SyncService syncService;

    @Inject
    IntegrationDatabaseCleaner cleaner;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    HerdLotRepository herdLotRepository;

    @Inject
    HerdLotAssignmentRepository herdLotAssignmentRepository;

    @Inject
    HerdProductivityLedgerRepository herdProductivityLedgerRepository;

    @Inject
    HerdCostLedgerRepository herdCostLedgerRepository;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            cleaner.clean();
            herdCostLedgerRepository.deleteAll();
            herdProductivityLedgerRepository.deleteAll();
            herdLotAssignmentRepository.deleteAll();
            herdLotRepository.deleteAll();
            ganaderoRepository.persist(buildOwner());
            animalRepository.persist(buildAnimal());
            herdLotRepository.persist(buildLot());
        });
    }

    @Test
    void shouldCanonicalizeProductivityLedgerByIdentityAndPullSingleCanonicalRecord() {
        PushSyncResponse first = pushProductivity("11111111-1111-4111-8111-111111111111", "2026-04-26T10:00:00Z", 100);
        PushSyncResponse second = pushProductivity("22222222-2222-4222-8222-222222222222", "2026-04-27T10:00:00Z", 120);
        PushSyncResponse olderReplay = pushProductivity("33333333-3333-4333-8333-333333333333", "2026-04-25T10:00:00Z", 80);

        HerdProductivityLedger persisted = QuarkusTransaction.requiringNew().call(() -> herdProductivityLedgerRepository.findAll().firstResult());
        PullSyncResponse pull = syncService.pull(SyncEntityType.PRODUCTIVITY_LEDGER, null, null);

        assertEquals("no_conflict", first.results().getFirst().classification());
        assertEquals("no_conflict", second.results().getFirst().classification());
        assertEquals("no_conflict", olderReplay.results().getFirst().classification());
        assertEquals(1, herdProductivityLedgerRepository.count());
        assertEquals(0, persisted.getValue().compareTo(new BigDecimal("120")));
        assertEquals(1, pull.items().size());
        assertEquals("120.00", String.valueOf(pull.items().getFirst().get("value")));
    }

    @Test
    void shouldBreakCostLedgerTiesUsingOperationIdWhenUpdatedAtMatches() {
        pushCost("11111111-1111-4111-8111-111111111111", "2026-04-27T10:00:00Z", 80);
        pushCost("99999999-9999-4999-8999-999999999999", "2026-04-27T10:00:00Z", 90);

        HerdCostLedger persisted = QuarkusTransaction.requiringNew().call(() -> herdCostLedgerRepository.findAll().firstResult());

        assertEquals(1, herdCostLedgerRepository.count());
        assertEquals(0, persisted.getAmount().compareTo(new BigDecimal("90")));
    }

    @Test
    void shouldRejectOverlappingLotAssignments() {
        UUID secondLotId = UUID.fromString("cccccccc-1111-4444-8888-000000000002");
        QuarkusTransaction.requiringNew().run(() -> herdLotRepository.persist(buildLot(secondLotId, "Lote B")));

        PushSyncResponse first = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("44444444-4444-4444-8444-444444444444"),
                SyncEntityType.LOT_ASSIGNMENT,
                "44444444-4444-4444-8444-444444444444",
                SyncOperationType.CREATE,
                Map.of("animalUuid", ANIMAL_ID.toString(), "lotId", LOT_ID.toString(), "fromDate", "2026-04-01"),
                0,
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                OffsetDateTime.parse("2026-04-27T10:00:00Z")))));
        PushSyncResponse second = syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString("55555555-5555-4555-8555-555555555555"),
                SyncEntityType.LOT_ASSIGNMENT,
                "55555555-5555-4555-8555-555555555555",
                SyncOperationType.CREATE,
                Map.of("animalUuid", ANIMAL_ID.toString(), "lotId", secondLotId.toString(), "fromDate", "2026-04-15"),
                0,
                OffsetDateTime.parse("2026-04-27T10:01:00Z"),
                OffsetDateTime.parse("2026-04-27T10:01:00Z")))));

        assertEquals("no_conflict", first.results().getFirst().classification());
        assertEquals("validation_error", second.results().getFirst().classification());
        assertEquals("LOT_ASSIGNMENT_OVERLAP", second.results().getFirst().conflict().reason());
    }

    private PushSyncResponse pushProductivity(String operationId, String updatedAt, int value) {
        return syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString(operationId),
                SyncEntityType.PRODUCTIVITY_LEDGER,
                operationId,
                SyncOperationType.CREATE,
                Map.of(
                        "animalUuid", ANIMAL_ID.toString(),
                        "lotId", LOT_ID.toString(),
                        "periodKey", "2026-04",
                        "metricType", "MILK_LITERS",
                        "value", value),
                0,
                OffsetDateTime.parse(updatedAt),
                OffsetDateTime.parse(updatedAt)))));
    }

    private PushSyncResponse pushCost(String operationId, String updatedAt, int amount) {
        return syncService.push(new PushSyncRequest(java.util.List.of(new SyncOperationRequest(
                UUID.fromString(operationId),
                SyncEntityType.COST_LEDGER,
                operationId,
                SyncOperationType.CREATE,
                Map.of(
                        "lotId", LOT_ID.toString(),
                        "periodKey", "2026-04",
                        "category", "FEED",
                        "source", "PURCHASE",
                        "amount", amount,
                        "currency", "BOB"),
                0,
                OffsetDateTime.parse(updatedAt),
                OffsetDateTime.parse(updatedAt)))));
    }

    private Ganadero buildOwner() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(OWNER_ID);
        ganadero.setBusinessIdentifier("NIT-HERD-V2");
        ganadero.setName("Ganadero Herd V2");
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal() {
        Animal animal = new Animal();
        animal.setUuid(ANIMAL_ID);
        animal.setCode("CODE-LOT-1");
        animal.setTag("BO-LOT-1");
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
        animal.setArete("BO-LOT-1");
        animal.setAreteNormalized("bo-lot-1");
        animal.setMarca("BO-LOT-1");
        animal.setMarcaNormalized("bo-lot-1");
        animal.setCategory(AnimalCategory.VACA);
        animal.setSex(AnimalSex.HEMBRA);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("410.00"));
        animal.setVersion(0L);
        animal.setCreatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        animal.setUpdatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        return animal;
    }

    private HerdLot buildLot() {
        return buildLot(LOT_ID, "Lote A");
    }

    private HerdLot buildLot(UUID lotId, String name) {
        HerdLot lot = new HerdLot();
        lot.setLotId(lotId);
        lot.setName(name);
        lot.setDescription(null);
        lot.setActive(true);
        lot.setOperationId(lotId);
        lot.setCreatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        lot.setUpdatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        return lot;
    }
}
