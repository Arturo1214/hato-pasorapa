package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AnimalReproductionEventRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalReproductionEventServiceTest {

    private static final UUID OWNER_ID = UUID.fromString("83ea4a4f-6f9d-45e3-ba1f-f247857dff67");
    private static final UUID USER_ID = UUID.fromString("196f80b3-c3df-44bc-97eb-20df7c333cac");

    @Inject
    AnimalReproductionEventService animalReproductionEventService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalReproductionEventRepository animalReproductionEventRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero());
        });
    }

    @Test
    void shouldCreateServiceAppendOnlyIdempotently() {
        UUID animalUuid = UUID.fromString("0a0da946-dcdb-4732-8ae7-054bc0e5f2ef");
        UUID operationId = UUID.fromString("e11237e7-6880-4f4e-b7db-8b29d38342aa");
        seedAnimal(animalUuid, "AR-service");

        var request = request(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                operationId,
                "Servicio natural",
                Map.of("serviceMethod", "NATURAL"));

        var created = animalReproductionEventService.create(request, USER_ID);
        var replayed = animalReproductionEventService.create(request, USER_ID);

        assertEquals(operationId, created.getOperationId());
        assertEquals(created.getEventId(), replayed.getEventId());
        assertEquals(1, animalReproductionEventRepository.count());
    }

    @Test
    void shouldProjectBirthParentageIntoOffspringAnimals() {
        UUID motherUuid = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID fatherUuid = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID calfOneUuid = UUID.fromString("33333333-3333-3333-3333-333333333333");
        UUID calfTwoUuid = UUID.fromString("44444444-4444-4444-4444-444444444444");
        seedAnimal(motherUuid, "AR-mother");
        seedAnimal(fatherUuid, "AR-father");
        seedAnimal(calfOneUuid, "AR-calf-1");
        seedAnimal(calfTwoUuid, "AR-calf-2");

        animalReproductionEventService.create(request(
                motherUuid,
                AnimalReproductionEventType.BIRTH,
                UUID.fromString("55555555-5555-5555-5555-555555555555"),
                "Parto doble",
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 2,
                        "motherAnimalUuid", motherUuid.toString(),
                        "fatherAnimalUuid", fatherUuid.toString(),
                        "offspringAnimalUuids", List.of(calfOneUuid.toString(), calfTwoUuid.toString()))), USER_ID);

        Animal calfOne = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(calfOneUuid).orElseThrow());
        Animal calfTwo = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(calfTwoUuid).orElseThrow());

        assertEquals(motherUuid, calfOne.getMotherAnimalUuid());
        assertEquals(fatherUuid, calfOne.getFatherAnimalUuid());
        assertEquals(LocalDate.of(2026, 4, 27), calfOne.getBirthDate());
        assertEquals(motherUuid, calfTwo.getMotherAnimalUuid());
        assertEquals(fatherUuid, calfTwo.getFatherAnimalUuid());
    }

    @Test
    void shouldRejectBirthWhenParentageProjectionWouldOverwriteExistingMother() {
        UUID motherUuid = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID conflictingMotherUuid = UUID.fromString("99999999-9999-9999-9999-999999999999");
        UUID calfUuid = UUID.fromString("33333333-3333-3333-3333-333333333333");
        seedAnimal(motherUuid, "AR-mother");
        seedAnimal(conflictingMotherUuid, "AR-mother-2");
        seedAnimal(calfUuid, "AR-calf-1");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal calf = animalRepository.findByUuid(calfUuid).orElseThrow();
            calf.setMotherAnimalUuid(conflictingMotherUuid);
        });

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                motherUuid,
                AnimalReproductionEventType.BIRTH,
                UUID.fromString("55555555-5555-5555-5555-555555555555"),
                "Parto conflictivo",
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", motherUuid.toString(),
                        "offspringAnimalUuids", List.of(calfUuid.toString()))), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT", exception.code());
    }

    @Test
    void shouldRejectBirthWhenFatherAnimalDoesNotExist() {
        UUID motherUuid = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID missingFatherUuid = UUID.fromString("77777777-7777-7777-7777-777777777777");
        UUID calfUuid = UUID.fromString("33333333-3333-3333-3333-333333333333");
        seedAnimal(motherUuid, "AR-mother");
        seedAnimal(calfUuid, "AR-calf-1");

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                motherUuid,
                AnimalReproductionEventType.BIRTH,
                UUID.fromString("88888888-8888-8888-8888-888888888888"),
                "Parto sin padre persistido",
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", motherUuid.toString(),
                        "fatherAnimalUuid", missingFatherUuid.toString(),
                        "offspringAnimalUuids", List.of(calfUuid.toString()))), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_FATHER_NOT_FOUND", exception.code());
    }

    private AnimalReproductionEventRequest request(
            UUID animalUuid,
            AnimalReproductionEventType type,
            UUID operationId,
            String notes,
            Map<String, Object> metadata) {
        return new AnimalReproductionEventRequest(
                animalUuid,
                type,
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                notes,
                USER_ID,
                "OFFLINE",
                operationId,
                metadata,
                OffsetDateTime.parse("2026-04-27T10:01:00Z"));
    }

    private void seedAnimal(UUID animalUuid, String tag) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + tag);
            animal.setTag("TAG-" + tag);
            animal.setArete(tag);
            animal.setAreteNormalized(tag.toLowerCase());
            animal.setMarca("Marca " + tag);
            animal.setMarcaNormalized(("Marca " + tag).toLowerCase());
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
            animal.setCategory(AnimalCategory.COW);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("400.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }

    private Ganadero buildGanadero() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(OWNER_ID);
        ganadero.setBusinessIdentifier("NIT-REPRO-001");
        ganadero.setName("Ganadero Repro");
        ganadero.setActive(true);
        return ganadero;
    }
}
