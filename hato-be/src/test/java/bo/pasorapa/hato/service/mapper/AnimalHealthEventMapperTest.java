package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalHealthEventMapperTest {

    private final AnimalHealthEventMapper mapper = new AnimalHealthEventMapper(new ObjectMapper());

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
                                "clinicalNote", Map.of("reason", "Cojera"),
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
