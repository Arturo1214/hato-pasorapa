package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
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
    AnimalEventLogRepository animalEventLogRepository;

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
        assertEquals(1, animalEventLogRepository.count("eventCategory", bo.pasorapa.hato.domain.enumeration.AnimalEventCategory.HEALTH));
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
        assertEquals(3, animalHealthEventService.list(animalUuid, null, null, null, null).size());
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
    void shouldProjectOneLatestVetVisitRowPerVisitIdAcrossLifecycleEvents() {
        UUID animalUuid = UUID.fromString("6ae6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(animalUuid, "VISIT-LATEST-800", "SPECIFIC", "PENDING", "Dra. Camila", 1, "2026-05-10T08:00:00");
        seedFieldVetEvent(animalUuid, "VISIT-LATEST-800", "SPECIFIC", "CANCELED", "Dra. Camila", 1, "2026-05-10T09:00:00");

        VetVisitFilterDto filter = new VetVisitFilterDto();
        filter.visitId = "VISIT-LATEST-800";
        filter.page = 0;
        filter.size = 20;

        var response = animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter);

        assertEquals(1, response.total());
        assertEquals("VISIT-LATEST-800", response.items().get(0).visitId());
        assertEquals("CANCELED", response.items().get(0).status());
        assertEquals(animalUuid, response.items().get(0).animalUuid());

        filter.status = "PENDING";
        assertEquals(0, animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).total());

        filter.status = "CANCELED";
        assertEquals(1, animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).total());
    }

    @Test
    void shouldProjectLatestFieldVetVisitRowsFromUnifiedLogByVisitId() {
        UUID animalUuid = UUID.fromString("31e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(animalUuid, "VISIT-UNIFIED-LATEST", "SPECIFIC", "PROGRAMADA", "Dra. Camila", 1, "2026-05-10T08:00:00");
        seedFieldVetEvent(animalUuid, "VISIT-UNIFIED-LATEST", "SPECIFIC", "CANCELADA", "Dra. Camila", 1, "2026-05-10T09:00:00");

        var latest = animalEventLogRepository.findByVisitIdRoot("VISIT-UNIFIED-LATEST");

        assertEquals(1, latest.size());
        assertEquals("VISIT-UNIFIED-LATEST", latest.get(0).getVisitId());
        assertEquals("CANCELADA", latest.get(0).getVisitStatus());
        assertEquals(animalUuid, latest.get(0).getAnimal().getUuid());
    }

    @Test
    void shouldReturnUnifiedVisitChildrenOrderedByOccurrence() {
        UUID animalUuid = UUID.fromString("32e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(animalUuid, "VISIT-UNIFIED-PARENT", "SPECIFIC", "ATENDIDA", "Dra. Camila", 1, "2026-05-10T08:00:00");
        seedFieldVetEvent(animalUuid, "VISIT-UNIFIED-CHILD-2", "SPECIFIC", "PROGRAMADA", "Dra. Camila", 1, "2026-05-12T08:00:00", null, null, "VISIT-UNIFIED-PARENT", null, "STARTED");
        seedFieldVetEvent(animalUuid, "VISIT-UNIFIED-CHILD-1", "SPECIFIC", "PROGRAMADA", "Dra. Camila", 1, "2026-05-11T08:00:00", null, null, "VISIT-UNIFIED-PARENT", null, "STARTED");

        var children = animalEventLogRepository.findByParentVisitId("VISIT-UNIFIED-PARENT");

        assertEquals(List.of("VISIT-UNIFIED-CHILD-1", "VISIT-UNIFIED-CHILD-2"), children.stream().map(item -> item.getVisitId()).toList());
    }

    @Test
    void shouldProjectGlobalVisitFromLatestLifecycleRowWhenFanOutRowsShareScheduledOccurrence() {
        UUID firstAnimal = UUID.fromString("16e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        UUID secondAnimal = UUID.fromString("17e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        String visitId = "VISIT-GLOBAL-LIFECYCLE-950";
        seedAnimal(firstAnimal);
        seedAnimal(secondAnimal);
        seedFieldVetEvent(
                firstAnimal,
                UUID.fromString("ffffffff-ffff-4fff-8fff-fffffffffff1"),
                visitId,
                "GLOBAL",
                "PENDING",
                "Dra. Camila",
                2,
                "2026-05-20T08:00:00",
                "Pendiente animal uno",
                null,
                null,
                null,
                null,
                "STARTED");
        seedFieldVetEvent(
                secondAnimal,
                UUID.fromString("ffffffff-ffff-4fff-8fff-fffffffffff2"),
                visitId,
                "GLOBAL",
                "PENDING",
                "Dra. Camila",
                2,
                "2026-05-20T08:00:00",
                "Pendiente animal dos",
                null,
                null,
                null,
                null,
                "STARTED");
        seedFieldVetEvent(
                firstAnimal,
                UUID.fromString("00000000-0000-4000-8000-000000000001"),
                visitId,
                "GLOBAL",
                "ATTENDED",
                "Dra. Camila",
                2,
                "2026-05-10T08:00:00",
                "Atención clínica cerrada animal uno",
                new BigDecimal("75.00"),
                List.of("Control finalizado"),
                null,
                null,
                "CLOSED");
        seedFieldVetEvent(
                secondAnimal,
                UUID.fromString("00000000-0000-4000-8000-000000000002"),
                visitId,
                "GLOBAL",
                "ATTENDED",
                "Dra. Camila",
                2,
                "2026-05-10T08:00:00",
                "Atención clínica cerrada animal dos",
                new BigDecimal("75.00"),
                List.of("Control finalizado"),
                null,
                null,
                "CLOSED");

        VetVisitFilterDto filter = new VetVisitFilterDto();
        filter.visitId = visitId;
        filter.page = 0;
        filter.size = 20;

        var response = animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter);

        assertEquals(1, response.total());
        var item = response.items().get(0);
        assertEquals(visitId, item.visitId());
        assertEquals("GLOBAL", item.mode());
        assertEquals("ATTENDED", item.status());
        assertEquals("CLOSED", item.chainStatus());
        assertEquals(null, item.animalUuid());
        assertEquals(2, item.targetAnimalCount());
        assertEquals("Atención clínica cerrada animal dos", item.atencionNotas());
        assertEquals(0, new BigDecimal("75.00").compareTo(item.costo()));
        assertEquals(List.of("Control finalizado"), item.treatmentPlan());

        filter.status = "PENDING";
        assertEquals(0, animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).total());

        filter.status = "ATTENDED";
        assertEquals(1, animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).total());
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
    void shouldProjectParentCancelReasonAndChainStatusForLatestVetVisitRows() {
        UUID animalUuid = UUID.fromString("14e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(animalUuid, "VISIT-PARENT-900", "SPECIFIC", "ATENDIDA", "Dra. Camila", 1, "2026-05-10T08:00:00");
        seedFieldVetEvent(
                animalUuid,
                "VISIT-CHILD-901",
                "SPECIFIC",
                "PROGRAMADA",
                "Dra. Camila",
                1,
                "2026-05-12T08:00:00",
                null,
                null,
                "VISIT-PARENT-900",
                null,
                "STARTED");
        seedFieldVetEvent(
                animalUuid,
                "VISIT-CHILD-901",
                "SPECIFIC",
                "CANCELADA",
                "Dra. Camila",
                1,
                "2026-05-12T09:00:00",
                null,
                null,
                "VISIT-PARENT-900",
                "Animal vendido",
                "CLOSED");

        VetVisitFilterDto filter = new VetVisitFilterDto();
        filter.mode = "SPECIFIC";
        filter.page = 0;
        filter.size = 20;

        var items = animalHealthEventService.getGlobalVisitsByOwner(OWNER_ID, filter).items();
        var parent = items.stream().filter(item -> "VISIT-PARENT-900".equals(item.visitId())).findFirst().orElseThrow();
        var child = items.stream().filter(item -> "VISIT-CHILD-901".equals(item.visitId())).findFirst().orElseThrow();

        assertEquals("ATENDIDA", parent.status());
        assertEquals(null, parent.parentVisitId());
        assertEquals(null, parent.cancelReason());
        assertEquals("ACTIVE", parent.chainStatus());
        assertEquals("VISIT-PARENT-900", child.parentVisitId());
        assertEquals("CANCELADA", child.status());
        assertEquals("Animal vendido", child.cancelReason());
        assertEquals("CLOSED", child.chainStatus());
    }

    @Test
    void shouldReturnVisitChainDetailOrderedByParentThenChildWithoutMutatingAttendedParent() {
        UUID animalUuid = UUID.fromString("15e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(
                animalUuid,
                "VISIT-CHAIN-PARENT",
                "SPECIFIC",
                "ATENDIDA",
                "Dra. Camila",
                1,
                "2026-05-10T08:00:00",
                null,
                List.of("Reposo"),
                null,
                null,
                "STARTED");
        seedFieldVetEvent(
                animalUuid,
                "VISIT-CHAIN-CHILD",
                "SPECIFIC",
                "CANCELADA",
                "Dra. Camila",
                1,
                "2026-05-12T09:00:00",
                null,
                null,
                "VISIT-CHAIN-PARENT",
                "Animal movido a otro potrero",
                "CLOSED");

        var chain = animalHealthEventService.getVisitChainDetail("VISIT-CHAIN-PARENT", USER_ID, false);

        assertEquals(2, chain.size());
        assertEquals("VISIT-CHAIN-PARENT", chain.get(0).visitId());
        assertEquals("ATENDIDA", chain.get(0).status());
        assertEquals(List.of("Reposo"), chain.get(0).treatmentPlan());
        assertEquals(null, chain.get(0).parentVisitId());
        assertEquals("VISIT-CHAIN-CHILD", chain.get(1).visitId());
        assertEquals("VISIT-CHAIN-PARENT", chain.get(1).parentVisitId());
        assertEquals("CANCELADA", chain.get(1).status());
        assertEquals("Animal movido a otro potrero", chain.get(1).cancelReason());
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

    @Test
    void shouldRejectAttendingFollowUpWithNewSiblingVisitIdWhenPendingChildExists() {
        UUID animalUuid = UUID.fromString("21e6c94d-4f97-47f1-9c27-db25b2d28cc4");
        seedAnimal(animalUuid);
        seedFieldVetEvent(animalUuid, "VISIT-FOLLOW-UP-PARENT", "GLOBAL", "ATENDIDA", "Dra. Camila", 1, "2026-05-10T08:00:00");
        seedFieldVetEvent(
                animalUuid,
                "VISIT-FOLLOW-UP-CHILD-PENDING",
                "GLOBAL",
                "PROGRAMADA",
                "Dra. Camila",
                1,
                "2026-05-12T08:00:00",
                null,
                null,
                "VISIT-FOLLOW-UP-PARENT",
                null,
                "STARTED");

        BusinessException exception = assertThrows(BusinessException.class, () -> animalHealthEventService.create(request(
                animalUuid,
                AnimalHealthEventType.FIELD_VET_VISIT,
                UUID.fromString("77777777-7777-4777-8777-777777777777"),
                "Finalización con sibling nuevo inválida",
                fieldVetMetadata("VISIT-FOLLOW-UP-SIBLING-NEW", "ATENDIDA", null, "VISIT-FOLLOW-UP-PARENT", "CLOSED"),
                "2026-05-12T09:00:00Z"), USER_ID));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_FOLLOW_UP_VISIT_ID_MISMATCH", exception.code());
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
        return fieldVetMetadata(visitId, status, nextDueAt, null, toProtocolStatus(status));
    }

    private Map<String, Object> fieldVetMetadata(String visitId, String status, String nextDueAt, String parentVisitId, String protocolStatusValue) {
        LinkedHashMap<String, Object> protocol = new LinkedHashMap<>();
        protocol.put("status", protocolStatusValue);
        if (nextDueAt != null) {
            protocol.put("nextDueAt", nextDueAt);
        }

        LinkedHashMap<String, Object> visit = new LinkedHashMap<>();
        visit.put("visitId", visitId);
        visit.put("mode", "SPECIFIC");
        visit.put("status", toVisitStatus(status));
        visit.put("veterinarian", Map.of("name", "Dra. Salud"));
        visit.put("atencionNotas", "Notas clínicas");
        if (parentVisitId != null) {
            visit.put("parentVisitId", parentVisitId);
        }

        return Map.of(
                "visit", visit,
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
        seedFieldVetEvent(animalUuid, visitId, mode, status, veterinarianName, targetAnimalCount, occurredAt, cost, treatmentPlan, null, null, "STARTED");
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
            List<String> treatmentPlan,
            String parentVisitId,
            String cancelReason,
            String protocolStatus) {
        seedFieldVetEvent(
                animalUuid,
                UUID.randomUUID(),
                visitId,
                mode,
                status,
                veterinarianName,
                targetAnimalCount,
                occurredAt,
                "Atención " + visitId,
                cost == null ? null : (BigDecimal) cost.get("amount"),
                treatmentPlan,
                parentVisitId,
                cancelReason,
                protocolStatus);
    }

    private void seedFieldVetEvent(
            UUID animalUuid,
            UUID eventId,
            String visitId,
            String mode,
            String status,
            String veterinarianName,
            int targetAnimalCount,
            String occurredAt,
            String atencionNotas,
            BigDecimal costAmount,
            List<String> treatmentPlan,
            String parentVisitId,
            String cancelReason,
            String protocolStatus) {
        QuarkusTransaction.requiringNew().run(() -> {
            LinkedHashMap<String, Object> metadata = new LinkedHashMap<>();
            LinkedHashMap<String, Object> visit = new LinkedHashMap<>();
            visit.put("visitId", visitId);
            visit.put("mode", mode);
            visit.put("status", status);
            visit.put("veterinarian", Map.of("name", veterinarianName));
            visit.put("targetAnimalCount", targetAnimalCount);
            visit.put("atencionNotas", atencionNotas);
            if (parentVisitId != null) {
                visit.put("parentVisitId", parentVisitId);
            }
            if (cancelReason != null) {
                visit.put("cancelReason", cancelReason);
                metadata.put("cancelReason", cancelReason);
            }
            metadata.put("visit", visit);
            metadata.put("checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true)));
            metadata.put("clinicalNote", Map.of(
                    "reason", "Control",
                    "findings", "Ok",
                    "plan", treatmentPlan == null ? "Seguimiento" : treatmentPlan));
            metadata.put("protocol", Map.of("status", protocolStatus));
            if (costAmount != null) {
                metadata.put("cost", Map.of("amount", costAmount, "currency", "BOB"));
            }

            var event = new bo.pasorapa.hato.service.model.AnimalHealthEvent();
            event.setEventId(eventId);
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
            animalEventLogRepository.persist(animalHealthEventMapper.toAnimalEventLog(event));
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
