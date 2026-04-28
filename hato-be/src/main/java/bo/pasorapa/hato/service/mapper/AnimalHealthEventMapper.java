package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class AnimalHealthEventMapper {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final Set<String> FIELD_VET_PROTOCOL_STATUSES = Set.of("STARTED", "FOLLOW_UP_REQUIRED", "CLOSED");
    private static final Set<String> FIELD_VET_CHECKLIST_CODES =
            Set.of("GENERAL_APPEARANCE", "TEMPERATURE", "HYDRATION", "APPETITE", "LOCOMOTION");

    private final ObjectMapper objectMapper;

    public AnimalHealthEventMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public AnimalHealthEventRequest toRequest(Map<String, Object> payload, OffsetDateTime clientCreatedAt) {
        UUID animalUuid = requireUuid(payload.get("animalUuid"), "ANIMAL_HEALTH_EVENT_ANIMAL_UUID_REQUIRED");
        UUID operationId = requireUuid(payload.get("operationId"), "ANIMAL_HEALTH_EVENT_OPERATION_ID_REQUIRED");
        String sourceChannel = normalizeSourceChannel(payload.get("sourceChannel"));
        AnimalHealthEventType healthEventType = readType(payload.get("healthEventType") != null ? payload.get("healthEventType") : payload.get("type"));
        OffsetDateTime occurredAt = requireOffsetDateTime(payload.get("occurredAt"), "ANIMAL_HEALTH_EVENT_OCCURRED_AT_REQUIRED");
        UUID performedByUserId = readOptionalUuid(payload.get("performedByUserId"), "ANIMAL_HEALTH_EVENT_PERFORMED_BY_REQUIRED");
        Map<String, Object> metadata = readMetadata(payload.get("metadata"));
        String notes = readOptionalText(payload.get("notes"));

        validateMetadata(healthEventType, metadata, notes);

        return new AnimalHealthEventRequest(
                animalUuid,
                healthEventType,
                occurredAt,
                notes,
                performedByUserId,
                sourceChannel,
                operationId,
                metadata,
                clientCreatedAt);
    }

    public AnimalHealthEvent toEntity(Animal animal, AnimalHealthEventRequest request, UUID effectivePerformedByUserId) {
        AnimalHealthEvent event = new AnimalHealthEvent();
        event.setAnimal(animal);
        event.setHealthEventType(request.healthEventType());
        event.setOccurredAt(request.occurredAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        event.setClientCreatedAt(request.clientCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        event.setNotes(request.notes());
        event.setPerformedByUserId(effectivePerformedByUserId);
        event.setSourceChannel(request.sourceChannel());
        event.setOperationId(request.operationId());
        event.setMetadataJson(writeMetadataJson(request.metadata()));
        return event;
    }

    public AnimalHealthEventResponse toResponse(AnimalHealthEvent event) {
        Map<String, Object> metadata = readMetadataJson(event.getMetadataJson());
        return toResponse(event, readVisitId(metadata), null, readNextDueAt(metadata));
    }

    public AnimalHealthEventResponse toResponse(
            AnimalHealthEvent event,
            String visitId,
            String followUpStatus,
            OffsetDateTime nextDueAt) {
        return new AnimalHealthEventResponse(
                event.getEventId(),
                event.getAnimal().getUuid(),
                event.getHealthEventType(),
                event.getOccurredAt().atOffset(ZoneOffset.UTC),
                event.getNotes(),
                event.getPerformedByUserId(),
                event.getSourceChannel(),
                event.getOperationId(),
                readMetadataJson(event.getMetadataJson()),
                visitId,
                followUpStatus,
                nextDueAt,
                event.getClientCreatedAt().atOffset(ZoneOffset.UTC),
                event.getCreatedAt().atOffset(ZoneOffset.UTC),
                event.getUpdatedAt().atOffset(ZoneOffset.UTC));
    }

    public Map<String, Object> toPullItem(AnimalHealthEvent event) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", event.getOperationId().toString());
        item.put("animalUuid", event.getAnimal().getUuid().toString());
        item.put("healthEventType", event.getHealthEventType().name());
        item.put("occurredAt", event.getOccurredAt().atOffset(ZoneOffset.UTC));
        item.put("notes", event.getNotes());
        item.put("performedByUserId", event.getPerformedByUserId().toString());
        item.put("sourceChannel", event.getSourceChannel());
        item.put("operationId", event.getOperationId().toString());
        item.put("metadata", readMetadataJson(event.getMetadataJson()));
        item.put("clientCreatedAt", event.getClientCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("createdAt", event.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("updatedAt", event.getUpdatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    public Map<String, Object> readMetadataJson(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(metadataJson, MAP_TYPE);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not deserialize animal health event metadata.", exception);
        }
    }

    public String writeMetadataJson(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not serialize animal health event metadata.", exception);
        }
    }

    public String normalizeSourceChannel(Object sourceChannel) {
        String normalized = requireText(sourceChannel, "ANIMAL_HEALTH_EVENT_SOURCE_CHANNEL_REQUIRED").toUpperCase();
        if (!"ONLINE".equals(normalized) && !"OFFLINE".equals(normalized)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_SOURCE_CHANNEL_INVALID");
        }
        return normalized;
    }

    public void validateMetadata(AnimalHealthEventType type, Map<String, Object> metadata, String notes) {
        rejectOutOfScopeAttachments(metadata);

        switch (type) {
            case VACCINATION, DEWORMING -> requireText(metadata.get("productName"), "ANIMAL_HEALTH_EVENT_PRODUCT_NAME_REQUIRED");
            case DISEASE_REPORTED -> {
                String diagnosisCode = readOptionalText(metadata.get("diagnosisCode"));
                if (diagnosisCode == null && notes == null) {
                    throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_DIAGNOSIS_OR_NOTES_REQUIRED");
                }
            }
            case TREATMENT_STARTED, TREATMENT_FOLLOW_UP, TREATMENT_CLOSED -> {
                requireText(metadata.get("treatmentCaseId"), "ANIMAL_HEALTH_EVENT_TREATMENT_CASE_ID_REQUIRED");
                requireText(metadata.get("productName"), "ANIMAL_HEALTH_EVENT_PRODUCT_NAME_REQUIRED");
                if (notes == null) {
                    throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_TREATMENT_STATUS_NOTE_REQUIRED");
                }
            }
            case FIELD_VET_VISIT -> validateFieldVetVisit(metadata);
        }

        if (metadata.containsKey("nextDueAt") && metadata.get("nextDueAt") != null) {
            requireOffsetDateTime(metadata.get("nextDueAt"), "ANIMAL_HEALTH_EVENT_NEXT_DUE_AT_INVALID");
        }
    }

    public String readTreatmentCaseId(Map<String, Object> metadata) {
        return readOptionalText(metadata.get("treatmentCaseId"));
    }

    public String readVisitId(Map<String, Object> metadata) {
        Map<String, Object> visit = readOptionalMap(metadata.get("visit"));
        return visit == null ? null : readOptionalText(visit.get("visitId"));
    }

    public String readFieldVetProtocolStatus(Map<String, Object> metadata) {
        Map<String, Object> protocol = readOptionalMap(metadata.get("protocol"));
        return protocol == null ? null : readOptionalText(protocol.get("status"));
    }

    public OffsetDateTime readNextDueAt(Map<String, Object> metadata) {
        Map<String, Object> protocol = readOptionalMap(metadata.get("protocol"));
        if (protocol != null && protocol.get("nextDueAt") != null) {
            return requireOffsetDateTime(protocol.get("nextDueAt"), "ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_INVALID");
        }
        if (metadata.get("nextDueAt") != null) {
            return requireOffsetDateTime(metadata.get("nextDueAt"), "ANIMAL_HEALTH_EVENT_NEXT_DUE_AT_INVALID");
        }
        return null;
    }

    public String readOptionalText(Object value) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_NOTES_INVALID");
        }
        String normalized = text.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    public Set<String> fieldVetChecklistCodes() {
        return FIELD_VET_CHECKLIST_CODES;
    }

    private void rejectOutOfScopeAttachments(Map<String, Object> metadata) {
        boolean containsUnsupportedField = collectMetadataKeys(metadata).stream().anyMatch(key -> key.contains("attachment")
                || key.contains("image")
                || key.contains("multimedia")
                || key.contains("billing")
                || key.contains("cost")
                || key.contains("price")
                || key.contains("prescription"));

        if (containsUnsupportedField) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_ATTACHMENTS_NOT_SUPPORTED");
        }
    }

    private AnimalHealthEventType readType(Object rawType) {
        String value = requireText(rawType, "ANIMAL_HEALTH_EVENT_TYPE_REQUIRED");
        try {
            return AnimalHealthEventType.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_TYPE_INVALID");
        }
    }

    private Map<String, Object> readMetadata(Object rawMetadata) {
        if (rawMetadata == null) {
            return Map.of();
        }
        if (!(rawMetadata instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_METADATA_INVALID");
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        map.forEach((key, value) -> normalized.put(String.valueOf(key), value));
        return normalized;
    }

    private void validateFieldVetVisit(Map<String, Object> metadata) {
        Map<String, Object> visit = requireMap(metadata.get("visit"), "ANIMAL_HEALTH_EVENT_VET_VISIT_REQUIRED");
        requireText(visit.get("visitId"), "ANIMAL_HEALTH_EVENT_VET_VISIT_ID_REQUIRED");

        List<Map<String, Object>> checklist = requireListOfMaps(metadata.get("checklist"), "ANIMAL_HEALTH_EVENT_VET_CHECKLIST_REQUIRED");
        if (checklist.isEmpty()) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_CHECKLIST_REQUIRED");
        }
        for (Map<String, Object> item : checklist) {
            String code = requireText(item.get("code"), "ANIMAL_HEALTH_EVENT_VET_CHECKLIST_CODE_REQUIRED");
            if (!FIELD_VET_CHECKLIST_CODES.contains(code)) {
                throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_CHECKLIST_CODE_INVALID");
            }
            if (!(item.get("ok") instanceof Boolean)) {
                throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_CHECKLIST_OK_REQUIRED");
            }
            readOptionalText(item.get("note"));
        }

        Map<String, Object> clinicalNote = requireMap(metadata.get("clinicalNote"), "ANIMAL_HEALTH_EVENT_VET_CLINICAL_NOTE_REQUIRED");
        requireText(clinicalNote.get("reason"), "ANIMAL_HEALTH_EVENT_VET_CLINICAL_REASON_REQUIRED");
        requireText(clinicalNote.get("findings"), "ANIMAL_HEALTH_EVENT_VET_CLINICAL_FINDINGS_REQUIRED");
        requireText(clinicalNote.get("plan"), "ANIMAL_HEALTH_EVENT_VET_CLINICAL_PLAN_REQUIRED");

        Map<String, Object> protocol = requireMap(metadata.get("protocol"), "ANIMAL_HEALTH_EVENT_VET_PROTOCOL_REQUIRED");
        String status = requireText(protocol.get("status"), "ANIMAL_HEALTH_EVENT_VET_PROTOCOL_STATUS_REQUIRED");
        if (!FIELD_VET_PROTOCOL_STATUSES.contains(status)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_PROTOCOL_STATUS_INVALID");
        }
        if ("FOLLOW_UP_REQUIRED".equals(status) && protocol.get("nextDueAt") == null) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_REQUIRED");
        }
        if (protocol.get("nextDueAt") != null) {
            requireOffsetDateTime(protocol.get("nextDueAt"), "ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_INVALID");
        }
    }

    private List<String> collectMetadataKeys(Map<String, Object> metadata) {
        List<String> keys = new ArrayList<>();
        collectMetadataKeys(metadata, keys);
        return keys;
    }

    private void collectMetadataKeys(Object value, List<String> keys) {
        if (value instanceof Map<?, ?> map) {
            map.forEach((key, nestedValue) -> {
                keys.add(key == null ? "" : key.toString().trim().toLowerCase());
                collectMetadataKeys(nestedValue, keys);
            });
            return;
        }

        if (value instanceof Iterable<?> iterable) {
            iterable.forEach(item -> collectMetadataKeys(item, keys));
        }
    }

    private Map<String, Object> requireMap(Object value, String errorCode) {
        Map<String, Object> map = readOptionalMap(value);
        if (map == null) {
            throw new IllegalArgumentException(errorCode);
        }
        return map;
    }

    private Map<String, Object> readOptionalMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return null;
        }
        Map<String, Object> normalized = new LinkedHashMap<>();
        map.forEach((key, nestedValue) -> normalized.put(String.valueOf(key), nestedValue));
        return normalized;
    }

    private List<Map<String, Object>> requireListOfMaps(Object value, String errorCode) {
        if (!(value instanceof Iterable<?> iterable)) {
            throw new IllegalArgumentException(errorCode);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (Object item : iterable) {
            items.add(requireMap(item, errorCode));
        }
        return items;
    }

    private OffsetDateTime requireOffsetDateTime(Object value, String errorCode) {
        String text = requireText(value, errorCode);
        try {
            return OffsetDateTime.parse(text);
        } catch (Exception exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private UUID requireUuid(Object value, String errorCode) {
        UUID uuid = readOptionalUuid(value, errorCode);
        if (uuid == null) {
            throw new IllegalArgumentException(errorCode);
        }
        return uuid;
    }

    private UUID readOptionalUuid(Object value, String errorCode) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private String requireText(Object value, String errorCode) {
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }
        return text.trim();
    }
}
