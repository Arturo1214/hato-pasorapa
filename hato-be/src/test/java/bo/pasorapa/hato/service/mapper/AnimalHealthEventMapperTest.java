package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.service.model.AnimalHealthEvent;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalHealthEventMapperTest {

    private final AnimalHealthEventMapper mapper = new AnimalHealthEventMapper(new ObjectMapper());

    @Test
    void shouldMapHealthEntityToUnifiedLogWithHealthCategoryAndMetadataPreserved() {
        UUID animalUuid = UUID.fromString("11111111-1111-4111-8111-111111111111");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        AnimalHealthEvent event = new AnimalHealthEvent();
        event.setEventId(UUID.fromString("22222222-2222-4222-8222-222222222222"));
        event.setAnimal(animal);
        event.setHealthEventType(AnimalHealthEventType.FIELD_VET_VISIT);
        event.setOccurredAt(LocalDateTime.parse("2026-05-10T08:00:00"));
        event.setClientCreatedAt(LocalDateTime.parse("2026-05-10T08:01:00"));
        event.setNotes("Visita proyectada");
        event.setPerformedByUserId(UUID.fromString("33333333-3333-4333-8333-333333333333"));
        event.setSourceChannel("OFFLINE");
        event.setOperationId(UUID.fromString("44444444-4444-4444-8444-444444444444"));
        event.setMetadataJson(mapper.writeMetadataJson(validFieldVetMetadata("VISIT-LOG-1", "STARTED", "2026-05-12T08:00:00Z")));
        event.setCreatedAt(LocalDateTime.parse("2026-05-10T08:02:00"));
        event.setUpdatedAt(LocalDateTime.parse("2026-05-10T08:03:00"));

        AnimalEventLog log = mapper.toAnimalEventLog(event);

        assertEquals(event.getEventId(), log.getEventId());
        assertEquals(animalUuid, log.getAnimal().getUuid());
        assertEquals(AnimalEventCategory.HEALTH, log.getEventCategory());
        assertEquals("FIELD_VET_VISIT", log.getEventType());
        assertEquals("VISIT-LOG-1", log.getVisitId());
        assertEquals("PROGRAMADA", log.getVisitStatus());
        assertEquals("STARTED", log.getProtocolStatus());
        assertEquals(OffsetDateTime.parse("2026-05-12T08:00:00Z").toLocalDateTime(), log.getNextDueAt());
        assertEquals(mapper.readMetadataJson(event.getMetadataJson()), mapper.readMetadataJson(log.getMetadataJson()));
    }

    @Test
    void shouldMapHealthRequestToUnifiedLogAndRejectCrossCategoryTypes() {
        UUID animalUuid = UUID.fromString("55555555-5555-4555-8555-555555555555");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "healthEventType", "VACCINATION",
                        "occurredAt", "2026-05-10T08:00:00Z",
                        "performedByUserId", "66666666-6666-4666-8666-666666666666",
                        "sourceChannel", "OFFLINE",
                        "operationId", "77777777-7777-4777-8777-777777777777",
                        "metadata", Map.of("productName", "Brucelosis")),
                OffsetDateTime.parse("2026-05-10T08:01:00Z"));

        AnimalEventLog log = mapper.toAnimalEventLog(animal, request, request.performedByUserId());

        assertEquals(AnimalEventCategory.HEALTH, log.getEventCategory());
        assertEquals("VACCINATION", log.getEventType());
        assertEquals("Brucelosis", mapper.readMetadataJson(log.getMetadataJson()).get("productName"));
        assertThrows(IllegalArgumentException.class, () -> mapper.validateHealthEventType("SOLD"));
    }

    @Test
    void shouldMapUnifiedHealthLogBackToHealthResponsePreservingFieldVetBlocks() {
        UUID animalUuid = UUID.fromString("88888888-8888-4888-8888-888888888888");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        Map<String, Object> metadata = new java.util.LinkedHashMap<>(validFieldVetMetadata("VISIT-LOG-DTO", "STARTED", null));
        metadata.put("cost", Map.of("amount", 150, "currency", "BOB"));
        metadata.put("treatmentPlan", List.of(Map.of("description", "Antibiótico", "order", 1)));
        metadata.put("cancelReason", "Control cancelado por clima");
        AnimalEventLog log = new AnimalEventLog();
        log.setEventId(UUID.fromString("99999999-9999-4999-8999-999999999999"));
        log.setAnimal(animal);
        log.setEventCategory(AnimalEventCategory.HEALTH);
        log.setEventType("FIELD_VET_VISIT");
        log.setOccurredAt(LocalDateTime.parse("2026-05-10T08:00:00"));
        log.setClientCreatedAt(LocalDateTime.parse("2026-05-10T08:01:00"));
        log.setNotes("Visita desde log");
        log.setPerformedByUserId(UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
        log.setSourceChannel("OFFLINE");
        log.setOperationId(UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
        log.setMetadataJson(mapper.writeMetadataJson(metadata));
        log.setVisitId("VISIT-LOG-DTO");
        log.setCreatedAt(LocalDateTime.parse("2026-05-10T08:02:00"));
        log.setUpdatedAt(LocalDateTime.parse("2026-05-10T08:03:00"));

        var response = mapper.toAnimalHealthEventDto(log);

        assertEquals("VISIT-LOG-DTO", response.visitId());
        assertEquals(Map.of("amount", 150, "currency", "BOB"), response.metadata().get("cost"));
        assertEquals(List.of(Map.of("description", "Antibiótico", "order", 1)), response.metadata().get("treatmentPlan"));
        assertEquals("Control cancelado por clima", response.metadata().get("cancelReason"));
        assertEquals("FIELD_VET_VISIT", response.healthEventType().name());
    }

    @Test
    void shouldMapVaccinationPayloadWithTypedMetadata() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "VACCINATION",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "notes", "Primera dosis",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "offline",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("productName", "Clostridial", "nextDueAt", "2026-10-27T10:00:00Z")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals(UUID.fromString("d249f65d-af66-4488-9e78-7a5996b8f1ea"), request.animalUuid());
        assertEquals("OFFLINE", request.sourceChannel());
        assertEquals("Clostridial", request.metadata().get("productName"));
    }

    @Test
    void shouldAllowDiseaseReportedWhenDiagnosisCodeIsPresent() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "DISEASE_REPORTED",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("diagnosisCode", "RESP-01")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals("DISEASE_REPORTED", request.healthEventType().name());
        assertEquals("RESP-01", request.metadata().get("diagnosisCode"));
    }

    @Test
    void shouldAcceptFieldVetVisitWithTypedBlocks() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "notes", "Control inicial",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", validFieldVetMetadata("VISIT-001", "STARTED", null)),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals("FIELD_VET_VISIT", request.healthEventType().name());
        assertEquals("VISIT-001", mapper.readVisitId(request.metadata()));
        assertEquals("GLOBAL", ((Map<?, ?>) request.metadata().get("visit")).get("mode"));
        assertEquals("PROGRAMADA", ((Map<?, ?>) request.metadata().get("visit")).get("status"));
    }

    @Test
    void shouldAcceptScheduledFieldVetVisitWithReasonOnly() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", validVisitBlock("VISIT-SCHEDULED"),
                                "checklist", List.of(),
                                "clinicalNote", Map.of("reason", "Control preventivo"),
                                "protocol", Map.of("status", "STARTED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals("Control preventivo", ((Map<?, ?>) request.metadata().get("clinicalNote")).get("reason"));
        assertEquals(List.of(), request.metadata().get("checklist"));
    }

    @Test
    void shouldAcceptAttendedFieldVetVisitWithAttentionNotesInsteadOfFindingsAndPlan() {
        Map<String, Object> visit = new java.util.LinkedHashMap<>(validVisitBlock("VISIT-ATTENDED"));
        visit.put("status", "ATENDIDA");
        visit.put("atencionNotas", "Se atendió al animal y quedó estable.");

        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "notes", "Se atendió al animal y quedó estable.",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", visit,
                                "checklist", List.of(),
                                "clinicalNote", Map.of("reason", "Cojera", "findings", "Cojera leve sin fiebre"),
                                "protocol", Map.of("status", "CLOSED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals("ATENDIDA", ((Map<?, ?>) request.metadata().get("visit")).get("status"));
        assertEquals("Cojera", ((Map<?, ?>) request.metadata().get("clinicalNote")).get("reason"));
    }

    @Test
    void shouldRejectAttendedFieldVetVisitWithoutAttentionNotes() {
        Map<String, Object> visit = new java.util.LinkedHashMap<>(validVisitBlock("VISIT-ATTENDED"));
        visit.put("status", "ATENDIDA");
        visit.remove("atencionNotas");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", visit,
                                "checklist", List.of(),
                                "clinicalNote", Map.of("reason", "Cojera"),
                                "protocol", Map.of("status", "CLOSED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_ATTENTION_NOTES_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectFieldVetVisitWithoutVisitMode() {
        Map<String, Object> metadata = validFieldVetMetadata("VISIT-001", "STARTED", null);
        Map<String, Object> visit = new java.util.LinkedHashMap<>((Map<String, Object>) metadata.get("visit"));
        visit.remove("mode");
        metadata = new java.util.LinkedHashMap<>(metadata);
        metadata.put("visit", visit);

        Map<String, Object> payload = Map.of(
                "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                "healthEventType", "FIELD_VET_VISIT",
                "occurredAt", "2026-04-27T10:00:00Z",
                "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                "sourceChannel", "OFFLINE",
                "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                "metadata", metadata);

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> mapper.toRequest(payload, OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_VISIT_MODE_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectFieldVetVisitInvalidLifecycleStatus() {
        Map<String, Object> metadata = validFieldVetMetadata("VISIT-001", "STARTED", null);
        Map<String, Object> visit = new java.util.LinkedHashMap<>((Map<String, Object>) metadata.get("visit"));
        visit.put("status", "EN_PROCESO");
        metadata = new java.util.LinkedHashMap<>(metadata);
        metadata.put("visit", visit);

        Map<String, Object> payload = Map.of(
                "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                "healthEventType", "FIELD_VET_VISIT",
                "occurredAt", "2026-04-27T10:00:00Z",
                "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                "sourceChannel", "OFFLINE",
                "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                "metadata", metadata);

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> mapper.toRequest(payload, OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_VISIT_STATUS_INVALID", exception.getMessage());
    }

    @Test
    void shouldRejectFieldVetVisitWithoutVisitId() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", validFieldVetMetadata(null, "STARTED", null)),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_VISIT_ID_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectFieldVetVisitWithoutClinicalNote() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", validVisitBlock("VISIT-001"),
                                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true)),
                                "protocol", Map.of("status", "STARTED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_CLINICAL_NOTE_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectFieldVetVisitChecklistOutsideFixedCatalog() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", validVisitBlock("VISIT-001"),
                                "checklist", List.of(Map.of("code", "FREE_TEXT", "ok", true)),
                                "clinicalNote", Map.of("reason", "Control", "findings", "Ok", "plan", "Seguir"),
                                "protocol", Map.of("status", "STARTED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_CHECKLIST_CODE_INVALID", exception.getMessage());
    }

    @Test
    void shouldRejectFieldVetVisitFollowUpRequiredWithoutNextDueAt() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", validFieldVetMetadata("VISIT-001", "FOLLOW_UP_REQUIRED", null)),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectDewormingWithoutProductName() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "DEWORMING",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of()),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_PRODUCT_NAME_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectTypesOutsideScope() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "REPRODUCTION",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of()),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_TYPE_INVALID", exception.getMessage());
    }

    @Test
    void shouldRejectClinicalAttachmentsAndBillingOutsideCurrentScope() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", validVisitBlock("VISIT-001"),
                                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true)),
                                "clinicalNote", Map.of("reason", "Control", "findings", "Ok", "plan", "Seguir"),
                                "protocol", Map.of("status", "STARTED"),
                                "billingCode", "COST-01")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_ATTACHMENTS_NOT_SUPPORTED", exception.getMessage());
    }

    @Test
    void shouldAcceptCostOnlyForFieldVetVisitAndRejectItForVaccination() {
        Map<String, Object> fieldVetMetadata = new java.util.LinkedHashMap<>(validFieldVetMetadata("VISIT-COST", "STARTED", null));
        fieldVetMetadata.put("cost", Map.of("amount", 150, "currency", "BOB"));

        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", fieldVetMetadata),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals(Map.of("amount", 150, "currency", "BOB"), mapper.readCost(request.metadata()));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "VACCINATION",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("productName", "Clostridial", "cost", Map.of("amount", 150, "currency", "BOB"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_ATTACHMENTS_NOT_SUPPORTED", exception.getMessage());
    }

    @Test
    void shouldRequireCancelReasonForCanceledFieldVetVisit() {
        Map<String, Object> visit = new java.util.LinkedHashMap<>(validVisitBlock("VISIT-CANCEL"));
        visit.put("status", "CANCELADA");
        visit.remove("atencionNotas");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", visit,
                                "checklist", List.of(),
                                "clinicalNote", Map.of("reason", "Control"),
                                "protocol", Map.of("status", "CLOSED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRequireFindingsForAttendedFieldVetVisit() {
        Map<String, Object> visit = new java.util.LinkedHashMap<>(validVisitBlock("VISIT-ATTENDED-FINDINGS"));
        visit.put("status", "ATENDIDA");
        visit.put("atencionNotas", "Se atendió y queda estable.");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "visit", visit,
                                "checklist", List.of(),
                                "clinicalNote", Map.of("reason", "Cojera"),
                                "protocol", Map.of("status", "STARTED"))),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_FINDINGS_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldReadCancelReasonAndNormalizeTreatmentPlanVariants() {
        assertEquals("Motivo clínico documentado", mapper.readCancelReason(Map.of(
                "visit", Map.of("cancelReason", " Motivo clínico documentado "))));
        assertEquals(List.of("Aplicar antibiótico", "Revisar en 7 días"), mapper.readTreatmentPlan(Map.of(
                "treatmentPlan", List.of(
                        Map.of("description", "Aplicar antibiótico", "order", 2),
                        Map.of("description", "Revisar en 7 días", "order", 3)))));
        assertEquals(List.of("Reposo y observación"), mapper.readTreatmentPlan(Map.of(
                "clinicalNote", Map.of("plan", " Reposo y observación "))));
        assertNull(mapper.readCost(Map.of()));
    }

    @Test
    void shouldRejectInvalidTreatmentPlanSteps() {
        Map<String, Object> metadata = new java.util.LinkedHashMap<>(validFieldVetMetadata("VISIT-PLAN", "STARTED", null));
        metadata.put("treatmentPlan", List.of(Map.of("description", "", "order", 1)));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "FIELD_VET_VISIT",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", metadata),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_DESCRIPTION_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRequireTreatmentThreadMetadataAndStatusNote() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "healthEventType", "TREATMENT_STARTED",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("productName", "Oxitetraciclina")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_HEALTH_EVENT_TREATMENT_CASE_ID_REQUIRED", exception.getMessage());
    }

    private Map<String, Object> validFieldVetMetadata(String visitId, String status, String nextDueAt) {
        java.util.LinkedHashMap<String, Object> protocol = new java.util.LinkedHashMap<>();
        protocol.put("status", status);
        if (nextDueAt != null) {
            protocol.put("nextDueAt", nextDueAt);
        }

        return Map.of(
                "visit", visitId == null ? Map.of() : Map.of(
                        "visitId", visitId,
                        "mode", "GLOBAL",
                        "status", "PROGRAMADA",
                        "veterinarian", Map.of("name", "Dra. Ana", "license", "MAT-1"),
                        "targetAnimalCount", 10,
                        "atencionNotas", "Control realizado"),
                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true), Map.of("code", "APPETITE", "ok", false, "note", "Baja")),
                "clinicalNote", Map.of("reason", "Control", "findings", "Leve fiebre", "plan", "Seguir protocolo"),
                "protocol", protocol);
    }

    private Map<String, Object> validVisitBlock(String visitId) {
        return Map.of(
                "visitId", visitId,
                "mode", "GLOBAL",
                "status", "PROGRAMADA",
                "veterinarian", Map.of("name", "Dra. Ana", "license", "MAT-1"),
                "targetAnimalCount", 10,
                "atencionNotas", "Control realizado");
    }
}
