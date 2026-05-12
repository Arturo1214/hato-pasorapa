package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalEventServiceTest {

    private static final UUID OWNER_A = UUID.fromString("6c4ab5c9-c9df-4b06-a858-ecbda97453f9");
    private static final UUID OWNER_B = UUID.fromString("f35dfad5-ef94-47d2-86fb-a20cc56c71dc");
    private static final UUID USER_ID = UUID.fromString("d4fc2017-4a45-40fd-9763-84561cff53d3");

    @Inject
    AnimalEventService animalEventService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventRepository animalEventRepository;

    @Inject
    AnimalEventLogRepository animalEventLogRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero(OWNER_A, "NIT-A", "Owner A"));
            ganaderoRepository.persist(buildGanadero(OWNER_B, "NIT-B", "Owner B"));
        });
    }

    @Test
    void shouldProjectAllV1RulesIntoCurrentAnimalState() {
        UUID transferredAnimalUuid = UUID.fromString("4a09fd87-57fb-44a4-8c21-cb4abcf87677");
        UUID deceasedAnimalUuid = UUID.fromString("09053442-7792-4db8-930c-f35d932c6f31");
        UUID observedAnimalUuid = UUID.fromString("9d9e54c8-b6d4-43ba-9a36-40db4b7f4073");
        seedAnimal(transferredAnimalUuid, OWNER_A, true);
        seedAnimal(deceasedAnimalUuid, OWNER_A, true);
        seedAnimal(observedAnimalUuid, OWNER_A, true);

        AnimalEvent transferred = animalEventService.create(fromRequest(
                transferredAnimalUuid,
                AnimalEventType.TRANSFERRED,
                "2026-04-27T10:00:00Z",
                Map.of(
                        "fromOwnerGanaderoId", OWNER_A.toString(),
                        "toOwnerGanaderoId", OWNER_B.toString()),
                UUID.fromString("f6204f7d-051d-4d55-b40f-3865e65c3fb0"),
                USER_ID));

        animalEventService.create(fromRequest(
                deceasedAnimalUuid,
                AnimalEventType.DECEASED,
                "2026-04-27T11:00:00Z",
                Map.of("reasonCode", "NATURAL_CAUSE"),
                UUID.fromString("daecc879-40df-489f-a4cd-e0481e7e2aa4"),
                USER_ID));

        animalEventService.create(fromRequest(
                observedAnimalUuid,
                AnimalEventType.OBSERVATION,
                "2026-04-27T12:00:00Z",
                Map.of("reasonCode", "GENERAL_NOTE"),
                UUID.fromString("1641f811-f844-459f-a9ad-ac3421ca7cdc"),
                USER_ID));

        Animal transferredAnimal = QuarkusTransaction.requiringNew()
                .call(() -> animalRepository.findByUuid(transferredAnimalUuid).orElseThrow());
        Animal deceasedAnimal = QuarkusTransaction.requiringNew()
                .call(() -> animalRepository.findByUuid(deceasedAnimalUuid).orElseThrow());
        Animal observedAnimal = QuarkusTransaction.requiringNew()
                .call(() -> animalRepository.findByUuid(observedAnimalUuid).orElseThrow());

        assertNotNull(transferred.getCreatedAt());
        assertEquals(OWNER_B, transferredAnimal.getOwnerGanadero().getId());
        assertEquals(true, transferredAnimal.getActive());
        assertEquals(false, deceasedAnimal.getActive());
        assertEquals(OWNER_A, observedAnimal.getOwnerGanadero().getId());
        assertEquals(true, observedAnimal.getActive());
    }

    @Test
    void shouldRebuildProjectionUsingOccurredAtClientCreatedAtAndOperationIdPrecedence() {
        UUID animalUuid = UUID.fromString("3f544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        seedAnimal(animalUuid, OWNER_A, true);

        animalEventService.create(new AnimalEventRequest(
                animalUuid,
                AnimalEventType.TRANSFERRED,
                OffsetDateTime.parse("2026-04-27T15:00:00Z"),
                "Transfer later",
                USER_ID,
                "OFFLINE",
                UUID.fromString("00000000-0000-0000-0000-000000000200"),
                Map.of(
                        "fromOwnerGanaderoId", OWNER_A.toString(),
                        "toOwnerGanaderoId", OWNER_B.toString()),
                OffsetDateTime.parse("2026-04-27T15:05:00Z")));

        animalEventService.create(new AnimalEventRequest(
                animalUuid,
                AnimalEventType.SOLD,
                OffsetDateTime.parse("2026-04-27T15:00:00Z"),
                "Sold same instant",
                USER_ID,
                "OFFLINE",
                UUID.fromString("00000000-0000-0000-0000-000000000100"),
                Map.of("reasonCode", "SALE"),
                OffsetDateTime.parse("2026-04-27T15:04:00Z")));

        Animal projected = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(animalUuid).orElseThrow());

        assertEquals(false, projected.getActive());
        assertEquals(OWNER_B, projected.getOwnerGanadero().getId());
    }

    @Test
    void shouldDerivePerformedByUserIdFromAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("9f544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        UUID authenticatedUserId = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        seedAnimal(animalUuid, OWNER_A, true);

        AnimalEvent created = animalEventService.create(new AnimalEventRequest(
                animalUuid,
                AnimalEventType.OBSERVATION,
                OffsetDateTime.parse("2026-04-27T18:00:00Z"),
                "Observación derivada",
                null,
                "OFFLINE",
                UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
                Map.of("reasonCode", "GENERAL_NOTE"),
                OffsetDateTime.parse("2026-04-27T18:01:00Z")), authenticatedUserId);

        assertEquals(authenticatedUserId, created.getPerformedByUserId());
    }

    @Test
    void shouldPersistGeneralEventsOnlyInUnifiedLogAndKeepListContract() {
        UUID animalUuid = UUID.fromString("70544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        UUID operationId = UUID.fromString("71544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        seedAnimal(animalUuid, OWNER_A, true);

        AnimalEvent created = animalEventService.create(fromRequest(
                animalUuid,
                AnimalEventType.OBSERVATION,
                "2026-05-11T10:00:00Z",
                Map.of("reasonCode", "GENERAL_NOTE"),
                operationId,
                USER_ID));
        var listed = animalEventService.list(animalUuid, AnimalEventType.OBSERVATION, null, null);

        assertEquals(operationId, created.getOperationId());
        assertEquals(0, animalEventRepository.count());
        assertEquals(1, animalEventLogRepository.count("eventCategory", AnimalEventCategory.GENERAL));
        assertEquals(1, listed.size());
        assertEquals(AnimalEventType.OBSERVATION, listed.getFirst().type());
        assertEquals(operationId, listed.getFirst().operationId());
    }

    @Test
    void shouldEnforceGeneralIdempotencyFromUnifiedLogOperationId() {
        UUID animalUuid = UUID.fromString("72544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        UUID operationId = UUID.fromString("73544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        seedAnimal(animalUuid, OWNER_A, true);
        AnimalEventRequest request = fromRequest(
                animalUuid,
                AnimalEventType.OBSERVATION,
                "2026-05-11T11:00:00Z",
                Map.of("reasonCode", "GENERAL_NOTE"),
                operationId,
                USER_ID);

        AnimalEvent created = animalEventService.create(request);
        AnimalEvent replayed = animalEventService.create(request);

        assertEquals(created.getEventId(), replayed.getEventId());
        assertEquals(1, animalEventLogRepository.count("operationId", operationId));
    }

    @Test
    void shouldRejectPerformedByUserMismatchAgainstAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("af544b7e-b0cf-4ba7-aee0-6e2094b88b76");
        seedAnimal(animalUuid, OWNER_A, true);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalEventService.create(new AnimalEventRequest(
                animalUuid,
                AnimalEventType.OBSERVATION,
                OffsetDateTime.parse("2026-04-27T19:00:00Z"),
                "Observación inválida",
                UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
                "OFFLINE",
                UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
                Map.of("reasonCode", "GENERAL_NOTE"),
                OffsetDateTime.parse("2026-04-27T19:01:00Z")), UUID.fromString("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")));

        assertEquals("ANIMAL_EVENT_PERFORMED_BY_MISMATCH", exception.code());
    }

    @Test
    void shouldApplyCastrationTransitionOnlyForEligibleMaleCategories() {
        UUID youngMaleUuid = UUID.fromString("9e6158e6-b245-4db8-9307-cb85f77458dd");
        UUID femaleUuid = UUID.fromString("f08f9cb2-32d0-4ff8-8c38-ea6563574d1a");
        seedAnimal(youngMaleUuid, OWNER_A, true);
        seedAnimal(femaleUuid, OWNER_A, true);

        QuarkusTransaction.requiringNew().run(() -> {
            animalRepository.findByUuid(youngMaleUuid).orElseThrow().setCategory(AnimalCategory.TERNERO);
            Animal female = animalRepository.findByUuid(femaleUuid).orElseThrow();
            female.setCategory(AnimalCategory.VACA);
            female.setSex(AnimalSex.HEMBRA);
        });

        animalEventService.create(fromRequest(
                youngMaleUuid,
                AnimalEventType.CASTRATION,
                "2026-04-27T20:00:00Z",
                Map.of("reasonCode", "SCHEDULED"),
                UUID.fromString("0f31bd62-0ba1-4418-93f1-d00e0fd4d4c4"),
                USER_ID));

        animalEventService.create(fromRequest(
                femaleUuid,
                AnimalEventType.CASTRATION,
                "2026-04-27T20:05:00Z",
                Map.of("reasonCode", "SCHEDULED"),
                UUID.fromString("8a5c25e2-0610-4af4-86e9-a9fdc9d2141c"),
                USER_ID));

        Animal castrated = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(youngMaleUuid).orElseThrow());
        Animal unchanged = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(femaleUuid).orElseThrow());

        assertEquals(AnimalCategory.BUEY, castrated.getCategory());
        assertEquals(AnimalCategory.VACA, unchanged.getCategory());
    }

    private AnimalEventRequest fromRequest(
            UUID animalUuid,
            AnimalEventType eventType,
            String occurredAt,
            Map<String, Object> metadata,
            UUID operationId,
            UUID performedByUserId) {
        return new AnimalEventRequest(
                animalUuid,
                eventType,
                OffsetDateTime.parse(occurredAt),
                "Notas " + eventType,
                performedByUserId,
                "OFFLINE",
                operationId,
                metadata,
                OffsetDateTime.parse(occurredAt).plusMinutes(1));
    }

    private void seedAnimal(UUID uuid, UUID ownerId, boolean active) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(uuid);
            animal.setCode("CODE-" + uuid);
            animal.setTag("TAG-" + uuid);
            animal.setArete("AR-" + uuid.toString().substring(0, 8));
            animal.setAreteNormalized(animal.getArete().toLowerCase());
            animal.setMarca("Marca " + uuid.toString().substring(0, 4));
            animal.setMarcaNormalized(animal.getMarca().toLowerCase());
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerId).orElseThrow());
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
            animal.setActive(active);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("400.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(name);
        ganadero.setActive(true);
        return ganadero;
    }
}
