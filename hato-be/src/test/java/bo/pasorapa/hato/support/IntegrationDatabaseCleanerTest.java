package bo.pasorapa.hato.support;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.OperationLog;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.SyncOperationReceipt;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AnimalReproductionEventRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.SyncOperationReceiptRepository;
import bo.pasorapa.hato.repository.UserRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class IntegrationDatabaseCleanerTest {

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventRepository animalEventRepository;

    @Inject
    AnimalHealthEventRepository animalHealthEventRepository;

    @Inject
    AnimalReproductionEventRepository animalReproductionEventRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    SyncOperationReceiptRepository syncOperationReceiptRepository;

    @Test
    void shouldCleanEveryDependentTableBeforeAnimalsAndGanaderos() {
        QuarkusTransaction.requiringNew().run(this::seedGraph);

        QuarkusTransaction.requiringNew().run(() -> integrationDatabaseCleaner.clean());

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(0, syncOperationReceiptRepository.count());
            assertEquals(0, operationLogRepository.count());
            assertEquals(0, animalReproductionEventRepository.count());
            assertEquals(0, animalHealthEventRepository.count());
            assertEquals(0, animalEventRepository.count());
            assertEquals(0, animalRepository.count());
            assertEquals(0, ganaderoRepository.count());
            assertEquals(0, userRepository.count());
        });
    }

    private void seedGraph() {
        User user = new User();
        user.setId(UUID.fromString("53aa807a-b3cd-498b-a898-30d31cebc7bd"));
        user.setUsername("cleanup-user");
        user.setEmail("cleanup-user@hato.bo");
        user.setDisplayName("Cleanup User");
        user.setPasswordHash("noop");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.persist(user);

        Ganadero ganadero = new Ganadero();
        ganadero.setId(UUID.fromString("ab2e7b15-3559-487f-80cd-b2dc01782a1b"));
        ganadero.setBusinessIdentifier("NIT-CLEAN-001");
        ganadero.setName("Ganadero Cleanup");
        ganadero.setActive(true);
        ganaderoRepository.persist(ganadero);

        Animal animal = new Animal();
        animal.setUuid(UUID.fromString("4c8a8127-4e97-47a7-a667-af493a6a204d"));
        animal.setCode("CLEAN-COW-001");
        animal.setTag("CLEAN-TAG-001");
        animal.setArete("CLEAN-001");
        animal.setAreteNormalized("clean-001");
        animal.setMarca("Cleanup Marca");
        animal.setMarcaNormalized("cleanup marca");
        animal.setOwnerGanadero(ganadero);
        animal.setCategory(AnimalCategory.COW);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("400.00"));
        animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 9, 0));
        animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 0));
        animal.setVersion(0L);
        animalRepository.persist(animal);

        AnimalEvent animalEvent = new AnimalEvent();
        animalEvent.setAnimal(animal);
        animalEvent.setType(AnimalEventType.OBSERVATION);
        animalEvent.setOccurredAt(LocalDateTime.of(2026, 4, 27, 10, 0));
        animalEvent.setClientCreatedAt(LocalDateTime.of(2026, 4, 27, 10, 0));
        animalEvent.setNotes("Weight recorded");
        animalEvent.setPerformedByUserId(user.getId());
        animalEvent.setSourceChannel("ONLINE");
        animalEvent.setOperationId(UUID.fromString("5d38ed1d-b1de-42d5-a771-c715cc2d3071"));
        animalEvent.setMetadataJson("{}");
        animalEventRepository.persist(animalEvent);

        AnimalHealthEvent animalHealthEvent = new AnimalHealthEvent();
        animalHealthEvent.setAnimal(animal);
        animalHealthEvent.setHealthEventType(AnimalHealthEventType.TREATMENT_STARTED);
        animalHealthEvent.setOccurredAt(LocalDateTime.of(2026, 4, 27, 11, 0));
        animalHealthEvent.setClientCreatedAt(LocalDateTime.of(2026, 4, 27, 11, 0));
        animalHealthEvent.setNotes("Treatment recorded");
        animalHealthEvent.setPerformedByUserId(user.getId());
        animalHealthEvent.setSourceChannel("ONLINE");
        animalHealthEvent.setOperationId(UUID.fromString("cf83fd8d-8739-4140-a182-48f1f92f11a0"));
        animalHealthEvent.setMetadataJson("{}");
        animalHealthEventRepository.persist(animalHealthEvent);

        AnimalReproductionEvent animalReproductionEvent = new AnimalReproductionEvent();
        animalReproductionEvent.setAnimal(animal);
        animalReproductionEvent.setReproductionEventType(AnimalReproductionEventType.SERVICE);
        animalReproductionEvent.setOccurredAt(LocalDateTime.of(2026, 4, 27, 12, 0));
        animalReproductionEvent.setClientCreatedAt(LocalDateTime.of(2026, 4, 27, 12, 0));
        animalReproductionEvent.setNotes("Service recorded");
        animalReproductionEvent.setPerformedByUserId(user.getId());
        animalReproductionEvent.setSourceChannel("ONLINE");
        animalReproductionEvent.setOperationId(UUID.fromString("ce557cf1-6baa-40c4-ae57-bfd685d4d56f"));
        animalReproductionEvent.setMetadataJson("{\"serviceMethod\":\"NATURAL\"}");
        animalReproductionEventRepository.persist(animalReproductionEvent);

        OperationLog operationLog = new OperationLog();
        operationLog.setOperationId(UUID.fromString("e45a287f-7f40-43d4-bb8c-7ec5f3bd7147"));
        operationLog.setResourceType("animal");
        operationLog.setResourceId(animal.getUuid());
        operationLog.setPerformedByUserId(user.getId());
        operationLog.setAction("CREATE");
        operationLogRepository.persist(operationLog);

        SyncOperationReceipt syncOperationReceipt = new SyncOperationReceipt();
        syncOperationReceipt.setOperationId(UUID.fromString("5201267b-a150-4e58-9ef2-607418da9d7c"));
        syncOperationReceipt.setEntityType("ANIMAL_REPRODUCTION_EVENT");
        syncOperationReceipt.setEntityId(animal.getUuid().toString());
        syncOperationReceipt.setClassification("no_conflict");
        syncOperationReceipt.setServerVersion(1);
        syncOperationReceipt.setClientVersion(1);
        syncOperationReceiptRepository.persist(syncOperationReceipt);
    }
}
