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
import bo.pasorapa.hato.service.dto.vetvisit.VetVisitFilterDto;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
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
    AnimalHealthEventMapper animalHealthEventMapper;

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

    @Test
    void shouldGroupGlobalVisitsByOwnerWithTargetAnimalCountAndScopedMetadata() {
        UUID firstAnimal = UUID.fromString("7ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        UUID secondAnimal = UUID.fromString("8ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(firstAnimal);
        seedAnimal(secondAnimal);
        seedFieldVetEvent(firstAnimal, "VISIT-GLOBAL-700", "GLOBAL", "PROGRAMADA", "Dra. Camila", 2, "2026-05-10T08:00:00");
        seedFieldVetEvent(secondAnimal, "VISIT-GLOBAL-700", "GLOBAL", "PROGRAMADA", "Dra. Camila", 2, "2026-05-10T08:00:00");
        seedFieldVetEvent(firstAnimal, "VISIT-SPECIFIC-701", "SPECIFIC", "PROGRAMADA", "Dr. Luis", 1, "2026-05-11T08:00:00");

        VetVisitFilterDto filter = new VetVisitFilterDto();
        filter.mode = "GLOBAL";
        filter.status = "PROGRAMADA";
        filter.page = 0;
        filter.size = 20;

        var response = animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter);

        assertEquals(1, response.total());
        assertEquals("VISIT-GLOBAL-700", response.items().get(0).visitId());
        assertEquals("GLOBAL", response.items().get(0).mode());
        assertEquals("PROGRAMADA", response.items().get(0).status());
        assertEquals("Dra. Camila", response.items().get(0).veterinarian().name());
        assertEquals(2, response.items().get(0).targetAnimalCount());
        assertEquals(null, response.items().get(0).animalUuid());
    }

    @Test
    void shouldProjectFieldVetVisitCostAndTreatmentPlanFromMetadata() {
        UUID animalUuid = UUID.fromString("12e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(
                animalUuid,
                "VISIT-COST-PLAN",
                "SPECIFIC",
                "ATENDIDA",
                "Dra. Camila",
                1,
                "2026-05-10T08:00:00",
                Map.of("amount", new BigDecimal("150.50"), "currency", "BOB"),
                List.of("Aplicar antibiótico", "Revisar en 7 días"));

        VetVisitFilterDto filter = new VetVisitFilterDto();
        filter.mode = "SPECIFIC";
        filter.page = 0;
        filter.size = 20;

        var item = animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).items().get(0);

        assertEquals(0, new BigDecimal("150.50").compareTo(item.costo()));
        assertEquals("BOB", item.costCurrency());
        assertEquals(List.of("Aplicar antibiótico", "Revisar en 7 días"), item.treatmentPlan());
    }

    @Test
    void shouldProjectLegacyStringPlanAndNullCostForFieldVetVisits() {
        UUID animalUuid = UUID.fromString("13e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(animalUuid, "VISIT-LEGACY-PLAN", "SPECIFIC", "ATENDIDA", "Dr. Luis", 1, "2026-05-11T08:00:00");

        VetVisitFilterDto filter = new VetVisitFilterDto();
        filter.mode = "SPECIFIC";
        filter.page = 0;
        filter.size = 20;

        var item = animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).items().get(0);

        assertEquals(null, item.costo());
        assertEquals(null, item.costCurrency());
        assertEquals(List.of("Seguimiento"), item.treatmentPlan());
    }

    @Test
    void shouldAcceptFieldVetVisitLifecycleContinuityAndRejectReopeningClosedChain() {
        UUID animalUuid = UUID.fromString("9ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);

        animalHealthEventService.create(request(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("11111111-1111-4111-8111-111111111111"), "Programada",
                fieldVetMetadata("VISIT-LIFE-001", "PROGRAMADA", null), "2026-05-10T08:00:00Z"), USER_ID);
        animalHealthEventService.create(request(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("22222222-2222-4222-8222-222222222222"), "Atendida con notas",
                fieldVetMetadata("VISIT-LIFE-001", "ATENDIDA", null), "2026-05-10T09:00:00Z"), USER_ID);
        animalHealthEventService.create(request(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("33333333-3333-4333-8333-333333333333"), "Reprogramada",
                fieldVetMetadata("VISIT-LIFE-001", "REPROGRAMADA", "2026-05-12T08:00:00Z"), "2026-05-10T10:00:00Z"), USER_ID);
        animalHealthEventService.create(request(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("44444444-4444-4444-8444-444444444444"), "Atendida seguimiento",
                fieldVetMetadata("VISIT-LIFE-001", "ATENDIDA", null), "2026-05-12T09:00:00Z"), USER_ID);
        animalHealthEventService.create(request(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("55555555-5555-4555-8555-555555555555"), "Finalizada",
                fieldVetMetadata("VISIT-LIFE-001", "FINALIZADA", null), "2026-05-12T10:00:00Z"), USER_ID);

        var timeline = animalHealthEventService.list(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, null, null, "VISIT-LIFE-001");
        assertEquals(5, timeline.size());
        assertEquals(List.of("CLOSED", "CLOSED", "CLOSED", "CLOSED", "CLOSED"), timeline.stream().map(item -> item.followUpStatus()).toList());

        BusinessException exception = assertThrows(BusinessException.class, () -> animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("66666666-6666-4666-8666-666666666666"),
                "Reapertura inválida",
                fieldVetMetadata("VISIT-LIFE-001", "ATENDIDA", null),
                "2026-05-12T11:00:00Z"), USER_ID));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_VISIT_CLOSED", exception.code());
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
        protocol.put("status", toProtocolStatus(status));
        if (nextDueAt != null) {
            protocol.put("nextDueAt", nextDueAt);
        }

        return Map.of(
                "visit", Map.of(
                        "visitId", visitId,
                        "mode", "SPECIFIC",
                        "status", toVisitStatus(status),
                        "veterinarian", Map.of("name", "Dra. Salud"),
                        "atencionNotas", "Notas clínicas"),
                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true), Map.of("code", "APPETITE", "ok", false, "note", "Disminuido")),
                "clinicalNote", Map.of("reason", "Control", "findings", "Leve fiebre", "plan", "Seguir tratamiento"),
                "protocol", protocol);
    }

    private String toVisitStatus(String status) {
        return switch (status) {
            case "STARTED" -> "PENDING";
            case "FOLLOW_UP_REQUIRED" -> "RESCHEDULED";
            case "CLOSED" -> "FINALIZED";
            default -> status;
        };
    }

    private String toProtocolStatus(String status) {
        return switch (status) {
            case "PROGRAMADA", "ATENDIDA" -> "STARTED";
            case "REPROGRAMADA" -> "FOLLOW_UP_REQUIRED";
            case "FINALIZADA", "CANCELADA" -> "CLOSED";
            default -> status;
        };
    }

    private void seedFieldVetEvent(
            UUID animalUuid,
            String visitId,
            String mode,
            String status,
            String veterinarianName,
            int targetAnimalCount,
            String occurredAt) {
        seedFieldVetEvent(animalUuid, visitId, mode, status, veterinarianName, targetAnimalCount, occurredAt, null, null);
    }

    private void seedFieldVetEvent(
            UUID animalUuid,
            String visitId,
            String mode,
            String status,
            String veterinarianName,
            int targetAnimalCount,
            String occurredAt,
            Map<String, Object> cost,
            List<String> treatmentPlan) {
        QuarkusTransaction.requiringNew().run(() -> {
            LinkedHashMap<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("visit", Map.of(
                    "visitId", visitId,
                    "mode", mode,
                    "status", status,
                    "veterinarian", Map.of("name", veterinarianName),
                    "targetAnimalCount", targetAnimalCount,
                    "atencionNotas", "Atención " + visitId));
            metadata.put("checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true)));
            metadata.put("clinicalNote", Map.of(
                    "reason", "Control",
                    "findings", "Ok",
                    "plan", treatmentPlan == null ? "Seguimiento" : treatmentPlan));
            metadata.put("protocol", Map.of("status", "STARTED"));
            if (cost != null) {
                metadata.put("cost", cost);
            }

            var event = new bo.pasorapa.hato.domain.AnimalHealthEvent();
            event.setEventId(UUID.randomUUID());
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setHealthEventType(AnimalHealthEventType.FIELD_VET_VISIT);
            event.setOccurredAt(LocalDateTime.parse(occurredAt));
            event.setClientCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setNotes("Visita veterinaria");
            event.setPerformedByUserId(USER_ID);
            event.setSourceChannel("OFFLINE");
            event.setOperationId(UUID.randomUUID());
            event.setMetadataJson(animalHealthEventMapper.writeMetadataJson(metadata));
            event.setCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setUpdatedAt(event.getCreatedAt());
            animalHealthEventRepository.persist(event);
        });
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
