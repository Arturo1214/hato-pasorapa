package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventResponse;
import bo.pasorapa.hato.service.model.AnimalReproductionEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AnimalReproductionEventMapper {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public AnimalReproductionEventMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public AnimalReproductionEventRequest toRequest(Map<String, Object> payload, OffsetDateTime clientCreatedAt) {
        UUID animalUuid = requireUuid(payload.get("animalUuid"), "ANIMAL_REPRODUCTION_EVENT_ANIMAL_UUID_REQUIRED");
        UUID operationId = requireUuid(payload.get("operationId"), "ANIMAL_REPRODUCTION_EVENT_OPERATION_ID_REQUIRED");
        String sourceChannel = normalizeSourceChannel(payload.get("sourceChannel"));
        AnimalReproductionEventType reproductionEventType = readType(payload.get("reproductionEventType") != null
                ? payload.get("reproductionEventType")
                : payload.get("type"));
        OffsetDateTime occurredAt = requireOffsetDateTime(payload.get("occurredAt"), "ANIMAL_REPRODUCTION_EVENT_OCCURRED_AT_REQUIRED");
        UUID performedByUserId = readOptionalUuid(payload.get("performedByUserId"), "ANIMAL_REPRODUCTION_EVENT_PERFORMED_BY_REQUIRED");
        Map<String, Object> metadata = readMetadata(payload.get("metadata"));
        String notes = readOptionalText(payload.get("notes"));

        validateMetadata(reproductionEventType, metadata);

        return new AnimalReproductionEventRequest(
                animalUuid,
                reproductionEventType,
                occurredAt,
                notes,
                performedByUserId,
                sourceChannel,
                operationId,
                metadata,
                clientCreatedAt);
    }

    public AnimalReproductionEvent toEntity(Animal animal, AnimalReproductionEventRequest request, UUID effectivePerformedByUserId) {
        AnimalReproductionEvent event = new AnimalReproductionEvent();
        event.setAnimal(animal);
        event.setReproductionEventType(request.reproductionEventType());
        event.setOccurredAt(request.occurredAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        event.setClientCreatedAt(request.clientCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        event.setNotes(request.notes());
        event.setPerformedByUserId(effectivePerformedByUserId);
        event.setSourceChannel(request.sourceChannel());
        event.setOperationId(request.operationId());
        event.setMetadataJson(writeMetadataJson(request.metadata()));
        return event;
    }

    public AnimalEventLog toAnimalEventLog(AnimalReproductionEvent event) {
        AnimalEventLog log = new AnimalEventLog();
        log.setEventId(event.getEventId());
        log.setAnimal(event.getAnimal());
        log.setEventCategory(AnimalEventCategory.REPRODUCTION);
        log.setEventType(validateReproductionEventType(event.getReproductionEventType().name()).name());
        log.setOccurredAt(event.getOccurredAt());
        log.setClientCreatedAt(event.getClientCreatedAt());
        log.setNotes(event.getNotes());
        log.setPerformedByUserId(event.getPerformedByUserId());
        log.setSourceChannel(event.getSourceChannel());
        log.setOperationId(event.getOperationId());
        log.setMetadataJson(event.getMetadataJson());
        log.setCreatedAt(event.getCreatedAt());
        log.setUpdatedAt(event.getUpdatedAt());
        return log;
    }

    public AnimalEventLog toAnimalEventLog(Animal animal, AnimalReproductionEventRequest request, UUID effectivePerformedByUserId) {
        AnimalEventLog log = new AnimalEventLog();
        log.setAnimal(animal);
        log.setEventCategory(AnimalEventCategory.REPRODUCTION);
        log.setEventType(validateReproductionEventType(request.reproductionEventType().name()).name());
        log.setOccurredAt(request.occurredAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        log.setClientCreatedAt(request.clientCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        log.setNotes(request.notes());
        log.setPerformedByUserId(effectivePerformedByUserId);
        log.setSourceChannel(request.sourceChannel());
        log.setOperationId(request.operationId());
        log.setMetadataJson(writeMetadataJson(request.metadata()));
        return log;
    }

    public AnimalReproductionEvent toAnimalReproductionEvent(AnimalEventLog log) {
        if (log.getEventCategory() != AnimalEventCategory.REPRODUCTION) {
            throw new IllegalArgumentException("ANIMAL_EVENT_LOG_CATEGORY_INVALID_FOR_REPRODUCTION");
        }
        AnimalReproductionEvent event = new AnimalReproductionEvent();
        event.setEventId(log.getEventId());
        event.setAnimal(log.getAnimal());
        event.setReproductionEventType(validateReproductionEventType(log.getEventType()));
        event.setOccurredAt(log.getOccurredAt());
        event.setClientCreatedAt(log.getClientCreatedAt());
        event.setNotes(log.getNotes());
        event.setPerformedByUserId(log.getPerformedByUserId());
        event.setSourceChannel(log.getSourceChannel());
        event.setOperationId(log.getOperationId());
        event.setMetadataJson(log.getMetadataJson());
        event.setCreatedAt(log.getCreatedAt());
        event.setUpdatedAt(log.getUpdatedAt());
        return event;
    }

    public AnimalReproductionEventResponse toAnimalReproductionEventDto(AnimalEventLog log) {
        return toResponse(toAnimalReproductionEvent(log));
    }

    public AnimalReproductionEventType validateReproductionEventType(String eventType) {
        try {
            return AnimalReproductionEventType.valueOf(eventType);
        } catch (Exception exception) {
            throw new IllegalArgumentException("ANIMAL_EVENT_LOG_REPRODUCTION_TYPE_INVALID");
        }
    }

    public AnimalReproductionEventResponse toResponse(AnimalReproductionEvent event) {
        return new AnimalReproductionEventResponse(
                event.getEventId(),
                event.getAnimal().getUuid(),
                event.getReproductionEventType(),
                event.getOccurredAt().atOffset(ZoneOffset.UTC),
                event.getNotes(),
                event.getPerformedByUserId(),
                event.getSourceChannel(),
                event.getOperationId(),
                readMetadataJson(event.getMetadataJson()),
                event.getClientCreatedAt().atOffset(ZoneOffset.UTC),
                event.getCreatedAt().atOffset(ZoneOffset.UTC),
                event.getUpdatedAt().atOffset(ZoneOffset.UTC));
    }

    public Map<String, Object> toPullItem(AnimalReproductionEvent event) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", event.getOperationId().toString());
        item.put("animalUuid", event.getAnimal().getUuid().toString());
        item.put("reproductionEventType", event.getReproductionEventType().name());
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
            throw new IllegalStateException("Could not deserialize animal reproduction event metadata.", exception);
        }
    }

    public String writeMetadataJson(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not serialize animal reproduction event metadata.", exception);
        }
    }

    public String normalizeSourceChannel(Object sourceChannel) {
        String normalized = requireText(sourceChannel, "ANIMAL_REPRODUCTION_EVENT_SOURCE_CHANNEL_REQUIRED").toUpperCase();
        if (!"ONLINE".equals(normalized) && !"OFFLINE".equals(normalized)) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_SOURCE_CHANNEL_INVALID");
        }
        return normalized;
    }

    public void validateMetadata(AnimalReproductionEventType type, Map<String, Object> metadata) {
        rejectOutOfScopeFields(metadata);

        switch (type) {
            case SERVICE -> requireText(metadata.get("serviceMethod"), "ANIMAL_REPRODUCTION_EVENT_SERVICE_METHOD_REQUIRED");
            case PREGNANCY_DIAGNOSIS -> validatePregnancyDiagnosisMetadata(metadata);
            case PREGNANCY_CONFIRMED ->
                    requireOffsetDateTime(metadata.get("confirmationDate"), "ANIMAL_REPRODUCTION_EVENT_CONFIRMATION_DATE_REQUIRED");
            case PREGNANCY_LOSS -> requireText(metadata.get("lossReason"), "ANIMAL_REPRODUCTION_EVENT_LOSS_REASON_REQUIRED");
            case BIRTH -> validateBirthMetadata(metadata);
        }
    }

    public BirthMetadata readBirthMetadata(Map<String, Object> metadata) {
        OffsetDateTime birthDate = requireOffsetDateTime(metadata.get("birthDate"), "ANIMAL_REPRODUCTION_EVENT_BIRTH_DATE_REQUIRED");
        int offspringCount = requireNonNegativeInteger(metadata.get("offspringCount"), "ANIMAL_REPRODUCTION_EVENT_OFFSPRING_COUNT_REQUIRED");
        UUID motherAnimalUuid = requireUuid(metadata.get("motherAnimalUuid"), "ANIMAL_REPRODUCTION_EVENT_MOTHER_ANIMAL_UUID_REQUIRED");
        UUID fatherAnimalUuid = readOptionalUuid(metadata.get("fatherAnimalUuid"), "ANIMAL_REPRODUCTION_EVENT_FATHER_ANIMAL_UUID_INVALID");
        List<UUID> offspringAnimalUuids = readUuidList(metadata.get("offspringAnimalUuids"), "ANIMAL_REPRODUCTION_EVENT_OFFSPRING_ANIMAL_UUIDS_INVALID");

        if (offspringCount > 0) {
            if (offspringAnimalUuids.isEmpty()) {
                throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_OFFSPRING_ANIMAL_UUIDS_REQUIRED");
            }
            if (offspringAnimalUuids.size() != offspringCount) {
                throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_OFFSPRING_COUNT_MISMATCH");
            }
        } else if (!offspringAnimalUuids.isEmpty()) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_OFFSPRING_COUNT_MISMATCH");
        }

        return new BirthMetadata(
                birthDate.toLocalDate(),
                offspringCount,
                motherAnimalUuid,
                fatherAnimalUuid,
                offspringAnimalUuids);
    }

    public String readOptionalText(Object value) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_NOTES_INVALID");
        }
        String normalized = text.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private void validateBirthMetadata(Map<String, Object> metadata) {
        readBirthMetadata(metadata);
    }

    private void validatePregnancyDiagnosisMetadata(Map<String, Object> metadata) {
        requireOffsetDateTime(metadata.get("diagnosisDate"), "ANIMAL_REPRODUCTION_EVENT_DIAGNOSIS_DATE_REQUIRED");
        String result = requireText(metadata.get("result"), "ANIMAL_REPRODUCTION_EVENT_DIAGNOSIS_RESULT_REQUIRED");
        if (!"PRENADA".equals(result) && !"NO_PRENADA".equals(result)) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_DIAGNOSIS_RESULT_INVALID");
        }
        if (metadata.get("expectedBirthDate") != null) {
            requireOffsetDateTime(metadata.get("expectedBirthDate"), "ANIMAL_REPRODUCTION_EVENT_EXPECTED_BIRTH_DATE_INVALID");
        }
        if (metadata.get("serviceEventUuid") != null) {
            requireUuid(metadata.get("serviceEventUuid"), "ANIMAL_REPRODUCTION_EVENT_SERVICE_EVENT_UUID_INVALID");
        }
        if (metadata.get("relatedServiceEventId") != null) {
            requireUuid(metadata.get("relatedServiceEventId"), "ANIMAL_REPRODUCTION_EVENT_RELATED_SERVICE_EVENT_ID_INVALID");
        }
    }

    private void rejectOutOfScopeFields(Map<String, Object> metadata) {
        boolean containsUnsupportedField = metadata.keySet().stream()
                .map(key -> key == null ? "" : key.trim().toLowerCase())
                .anyMatch(key -> key.contains("attachment") || key.contains("genetic") || key.contains("assisted"));

        if (containsUnsupportedField) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_OUT_OF_SCOPE_FIELD");
        }
    }

    private AnimalReproductionEventType readType(Object rawType) {
        String value = requireText(rawType, "ANIMAL_REPRODUCTION_EVENT_TYPE_REQUIRED");
        try {
            return AnimalReproductionEventType.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_TYPE_INVALID");
        }
    }

    private Map<String, Object> readMetadata(Object rawMetadata) {
        if (rawMetadata == null) {
            return Map.of();
        }
        if (!(rawMetadata instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("ANIMAL_REPRODUCTION_EVENT_METADATA_INVALID");
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        map.forEach((key, value) -> normalized.put(String.valueOf(key), value));
        return normalized;
    }

    private OffsetDateTime requireOffsetDateTime(Object value, String errorCode) {
        String text = requireText(value, errorCode);
        try {
            return OffsetDateTime.parse(text);
        } catch (Exception exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private int requireNonNegativeInteger(Object value, String errorCode) {
        if (value == null) {
            throw new IllegalArgumentException(errorCode);
        }

        try {
            int parsed = Integer.parseInt(String.valueOf(value));
            if (parsed < 0) {
                throw new IllegalArgumentException(errorCode);
            }
            return parsed;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private List<UUID> readUuidList(Object value, String errorCode) {
        if (value == null) {
            return List.of();
        }
        if (!(value instanceof List<?> list)) {
            throw new IllegalArgumentException(errorCode);
        }

        List<UUID> uuids = new ArrayList<>();
        for (Object item : list) {
            uuids.add(requireUuid(item, errorCode));
        }
        return uuids;
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

    public record BirthMetadata(
            LocalDate birthDate,
            int offspringCount,
            UUID motherAnimalUuid,
            UUID fatherAnimalUuid,
            List<UUID> offspringAnimalUuids) {
    }
}
