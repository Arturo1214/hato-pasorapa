package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalHealthEventServiceTest {

    private static final UUID OWNER_ID = UUID.fromString("83ea4a4f-6f9d-45e3-ba1f-f247857dff67");
    private static final UUID USER_ID = UUID.fromString("196f80b3-c3df-44bc-97eb-20df7c333cac");

    @Inject
    AnimalHealthEventService animalHealthEventService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalHealthEventRepository animalHealthEventRepository;

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
    void shouldCreateVaccinationAppendOnlyIdempotently() {
        UUID animalUuid = UUID.fromString("0a0da946-dcdb-4732-8ae7-054bc0e5f2ef");
        UUID operationId = UUID.fromString("e11237e7-6880-4f4e-b7db-8b29d38342aa");
        seedAnimal(animalUuid);

        var request = request(
                animalUuid,
                AnimalHealthEventType.VACCINATION,
                operationId,
                "Vacuna aplicada",
                Map.of("productName", "Brucelosis", "nextDueAt", "2026-10-27T10:00:00Z"),
                "2026-04-27T10:00:00Z");

        var created = animalHealthEventService.create(request, USER_ID);
        var replayed = animalHealthEventService.create(request, USER_ID);

        assertEquals(operationId, created.getOperationId());
        assertEquals(created.getEventId(), replayed.getEventId());
        assertEquals(1, animalHealthEventRepository.count());
    }

    @Test
    void shouldProjectFieldVetVisitAsActiveOrClosedAndFilterByVisitId() {
        UUID animalUuid = UUID.fromString("0ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);

        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("beaa146e-5360-4c9d-bab3-b7c5aa3cf311"),
                "Apertura visita",
                fieldVetMetadata("VISIT-001", "STARTED", null),
                "2026-04-27T10:00:00Z"), USER_ID);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("7e4e80f6-fb62-4496-a606-6460eb7abac2"),
                "Seguimiento visita",
                fieldVetMetadata("VISIT-001", "FOLLOW_UP_REQUIRED", "2026-04-29T10:00:00Z"),
                "2026-04-27T12:00:00Z"), USER_ID);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("d9c97438-9f14-4d25-a2ab-fb5bbe7cb2b2"),
                "Cierre visita",
                fieldVetMetadata("VISIT-001", "CLOSED", null),
                "2026-04-27T16:00:00Z"), USER_ID);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("42c4968d-5a88-4839-bfb1-71c640bf299d"),
                "Otra visita",
                fieldVetMetadata("VISIT-002", "STARTED", null),
                "2026-04-28T09:00:00Z"), USER_ID);

        var visitOne = animalHealthEventService.list(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                OffsetDateTime.parse("2026-04-27T00:00:00Z"),
                OffsetDateTime.parse("2026-04-29T00:00:00Z"),
                "VISIT-001");

        assertEquals(3, visitOne.size());
        assertEquals(List.of("VISIT-001", "VISIT-001", "VISIT-001"), visitOne.stream().map(item -> item.visitId()).toList());
        assertEquals(List.of("CLOSED", "CLOSED", "CLOSED"), visitOne.stream().map(item -> item.followUpStatus()).toList());

        var activeVisit = animalHealthEventService.list(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, null, null, "VISIT-002");
        assertEquals(1, activeVisit.size());
        assertEquals("ACTIVE", activeVisit.get(0).followUpStatus());
        assertEquals(null, activeVisit.get(0).nextDueAt());
    }

    @Test
    void shouldRejectFieldVetFollowUpAfterClosure() {
        UUID animalUuid = UUID.fromString("2ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);

        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("11111111-5360-4c9d-bab3-b7c5aa3cf311"),
                "Apertura visita",
                fieldVetMetadata("VISIT-900", "STARTED", null),
                "2026-04-27T10:00:00Z"), USER_ID);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("22222222-fb62-4496-a606-6460eb7abac2"),
                "Cierre visita",
                fieldVetMetadata("VISIT-900", "CLOSED", null),
                "2026-04-27T12:00:00Z"), USER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("33333333-9f14-4d25-a2ab-fb5bbe7cb2b2"),
                "Seguimiento tardío",
                fieldVetMetadata("VISIT-900", "FOLLOW_UP_REQUIRED", "2026-04-29T10:00:00Z"),
                "2026-04-27T13:00:00Z"), USER_ID));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_VISIT_CLOSED", exception.code());
    }

    @Test
    void shouldRejectFieldVetFollowUpRequiredWhenNextDueAtIsBeforeOccurrence() {
        UUID animalUuid = UUID.fromString("3ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("aaaaaaaa-5360-4c9d-bab3-b7c5aa3cf311"),
                "Apertura válida",
                fieldVetMetadata("VISIT-901", "STARTED", null),
                "2026-04-27T08:00:00Z"), USER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("44444444-5360-4c9d-bab3-b7c5aa3cf311"),
                "Seguimiento inválido",
                fieldVetMetadata("VISIT-901", "FOLLOW_UP_REQUIRED", "2026-04-27T09:00:00Z"),
                "2026-04-27T10:00:00Z"), USER_ID));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_BEFORE_OCCURRED_AT", exception.code());
    }

    @Test
    void shouldRejectDiseaseWithoutDiagnosisAndNotes() {
        UUID animalUuid = UUID.fromString("f2926cdb-7cc2-4ec8-b01f-cd09f47a0194");
        seedAnimal(animalUuid);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.DISEASE_REPORTED,
                UUID.fromString("5f02d309-c2da-4d55-b426-88e986314273"),
                null,
                Map.of(),
                "2026-04-27T10:00:00Z"), USER_ID));

        assertEquals("ANIMAL_HEALTH_EVENT_DIAGNOSIS_OR_NOTES_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldPreserveTreatmentTimelineAndRejectFollowUpAfterClosure() {
        UUID animalUuid = UUID.fromString("4ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);

        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.TREATMENT_STARTED,
                UUID.fromString("55555555-5360-4c9d-bab3-b7c5aa3cf311"),
                "Inicia tratamiento",
                treatmentMetadata("CASE-001", "Oxitetraciclina"),
                "2026-04-27T10:00:00Z"), USER_ID);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.TREATMENT_FOLLOW_UP,
                UUID.fromString("66666666-fb62-4496-a606-6460eb7abac2"),
                "Evolución favorable",
                treatmentMetadata("CASE-001", "Oxitetraciclina"),
                "2026-04-27T12:00:00Z"), USER_ID);
        animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.TREATMENT_CLOSED,
                UUID.fromString("77777777-9f14-4d25-a2ab-fb5bbe7cb2b2"),
                "Alta clínica",
                treatmentMetadata("CASE-001", "Oxitetraciclina"),
                "2026-04-27T16:00:00Z"), USER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.TREATMENT_FOLLOW_UP,
                UUID.fromString("88888888-5a88-4839-bfb1-71c640bf299d"),
                "Revisión tardía",
                treatmentMetadata("CASE-001", "Oxitetraciclina"),
                "2026-04-27T18:00:00Z"), USER_ID));

        assertEquals("ANIMAL_HEALTH_EVENT_TREATMENT_CASE_CLOSED", exception.code());
        assertEquals(3, animalHealthEventRepository.listByTreatmentCase(animalUuid, "CASE-001").size());
    }

    @Test
    void shouldDerivePerformedByUserIdFromAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("5ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        UUID authenticatedUserId = UUID.fromString("99999999-9999-4999-8999-999999999999");
        seedAnimal(animalUuid);

        AnimalHealthEventRequest request = new AnimalHealthEventRequest(
                animalUuid,
                AnimalHealthEventType.VACCINATION,
                OffsetDateTime.parse("2026-04-27T20:00:00Z"),
                "Vacuna anual",
                null,
                "OFFLINE",
                UUID.fromString("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"),
                Map.of("productName", "Brucelosis"),
                OffsetDateTime.parse("2026-04-27T20:01:00Z"));

        var created = animalHealthEventService.create(request, authenticatedUserId);

        assertEquals(authenticatedUserId, created.getPerformedByUserId());
    }

    @Test
    void shouldRejectPerformedByUserMismatchAgainstAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("6ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalHealthEventService.create(new AnimalHealthEventRequest(
                animalUuid,
                AnimalHealthEventType.VACCINATION,
                OffsetDateTime.parse("2026-04-27T21:00:00Z"),
                "Vacuna inválida",
                UUID.fromString("bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb"),
                "OFFLINE",
                UUID.fromString("cccccccc-1111-4111-8111-cccccccccccc"),
                Map.of("productName", "Brucelosis"),
                OffsetDateTime.parse("2026-04-27T21:01:00Z")), UUID.fromString("dddddddd-1111-4111-8111-dddddddddddd")));

        assertEquals("ANIMAL_HEALTH_EVENT_PERFORMED_BY_MISMATCH", exception.code());
    }

    private AnimalHealthEventRequest request(
            UUID animalUuid,
            AnimalHealthEventType type,
            UUID operationId,
            String notes,
            Map<String, Object> metadata,
            String occurredAt) {
        return new AnimalHealthEventRequest(
                animalUuid,
                type,
                OffsetDateTime.parse(occurredAt),
                notes,
                USER_ID,
                "OFFLINE",
                operationId,
                metadata,
                OffsetDateTime.parse("2026-04-27T10:01:00Z"));
    }

    private Map<String, Object> treatmentMetadata(String treatmentCaseId, String productName) {
        return Map.of("treatmentCaseId", treatmentCaseId, "productName", productName);
    }

    private Map<String, Object> fieldVetMetadata(String visitId, String status, String nextDueAt) {
        LinkedHashMap<String, Object> protocol = new LinkedHashMap<>();
        protocol.put("status", status);
        if (nextDueAt != null) {
            protocol.put("nextDueAt", nextDueAt);
        }

        return Map.of(
                "visit", Map.of("visitId", visitId),
                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true), Map.of("code", "APPETITE", "ok", false, "note", "Disminuido")),
                "clinicalNote", Map.of("reason", "Control", "findings", "Leve fiebre", "plan", "Seguir tratamiento"),
                "protocol", protocol);
    }

    private void seedAnimal(UUID animalUuid) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + animalUuid);
            animal.setTag("TAG-" + animalUuid);
            animal.setArete("AR-" + animalUuid.toString().substring(0, 8));
            animal.setAreteNormalized(animal.getArete().toLowerCase());
            animal.setMarca("Marca " + animalUuid.toString().substring(0, 4));
            animal.setMarcaNormalized(animal.getMarca().toLowerCase());
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
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
        ganadero.setBusinessIdentifier("NIT-HEALTH-001");
        ganadero.setName("Ganadero Salud");
        ganadero.setActive(true);
        return ganadero;
    }
}
