package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventResponse;
import bo.pasorapa.hato.service.model.AnimalEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AnimalEventMapper {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public AnimalEventMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public AnimalEventRequest toRequest(Map<String, Object> payload, java.time.OffsetDateTime clientCreatedAt) {
        UUID animalUuid = requireUuid(payload.get("animalUuid"), "ANIMAL_EVENT_ANIMAL_UUID_REQUIRED");
        UUID operationId = requireUuid(payload.get("operationId"), "ANIMAL_EVENT_OPERATION_ID_REQUIRED");
        String sourceChannel = requireText(payload.get("sourceChannel"), "ANIMAL_EVENT_SOURCE_CHANNEL_REQUIRED");
        AnimalEventType type = readType(payload.get("type"));
        java.time.OffsetDateTime occurredAt = requireOffsetDateTime(payload.get("occurredAt"), "ANIMAL_EVENT_OCCURRED_AT_REQUIRED");
        UUID performedByUserId = readOptionalUuid(payload.get("performedByUserId"), "ANIMAL_EVENT_PERFORMED_BY_REQUIRED");
        Map<String, Object> metadata = readMetadata(payload.get("metadata"));

        validateMetadata(type, metadata);

        return new AnimalEventRequest(
                animalUuid,
                type,
                occurredAt,
                readOptionalText(payload.get("notes")),
                performedByUserId,
                sourceChannel,
                operationId,
                metadata,
                clientCreatedAt);
    }

    public AnimalEvent toEntity(Animal animal, AnimalEventRequest request, UUID effectivePerformedByUserId) {
        AnimalEvent event = new AnimalEvent();
        event.setAnimal(animal);
        event.setType(request.type());
        event.setOccurredAt(request.occurredAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        event.setClientCreatedAt(request.clientCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        event.setNotes(readOptionalText(request.notes()));
        event.setPerformedByUserId(effectivePerformedByUserId);
        event.setSourceChannel(normalizeSourceChannel(request.sourceChannel()));
        event.setOperationId(request.operationId());
        event.setMetadataJson(writeMetadataJson(request.metadata()));
        return event;
    }

    public AnimalEventLog toAnimalEventLog(AnimalEvent event) {
        AnimalEventLog log = new AnimalEventLog();
        log.setEventId(event.getEventId());
        log.setAnimal(event.getAnimal());
        log.setEventCategory(AnimalEventCategory.GENERAL);
        log.setEventType(validateGeneralEventType(event.getType().name()).name());
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

    public AnimalEventLog toAnimalEventLog(Animal animal, AnimalEventRequest request, UUID effectivePerformedByUserId) {
        AnimalEventLog log = new AnimalEventLog();
        log.setAnimal(animal);
        log.setEventCategory(AnimalEventCategory.GENERAL);
        log.setEventType(validateGeneralEventType(request.type().name()).name());
        log.setOccurredAt(request.occurredAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        log.setClientCreatedAt(request.clientCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        log.setNotes(readOptionalText(request.notes()));
        log.setPerformedByUserId(effectivePerformedByUserId);
        log.setSourceChannel(normalizeSourceChannel(request.sourceChannel()));
        log.setOperationId(request.operationId());
        log.setMetadataJson(writeMetadataJson(request.metadata()));
        return log;
    }

    public AnimalEvent toAnimalEvent(AnimalEventLog log) {
        if (log.getEventCategory() != AnimalEventCategory.GENERAL) {
            throw new IllegalArgumentException("ANIMAL_EVENT_LOG_CATEGORY_INVALID_FOR_GENERAL");
        }
        AnimalEvent event = new AnimalEvent();
        event.setEventId(log.getEventId());
        event.setAnimal(log.getAnimal());
        event.setType(validateGeneralEventType(log.getEventType()));
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

    public AnimalEventResponse toAnimalEventDto(AnimalEventLog log) {
        return toResponse(toAnimalEvent(log));
    }

    public AnimalEventType validateGeneralEventType(String eventType) {
        try {
            AnimalEventType parsed = AnimalEventType.valueOf(eventType);
            return parsed;
        } catch (Exception exception) {
            throw new IllegalArgumentException("ANIMAL_EVENT_LOG_GENERAL_TYPE_INVALID");
        }
    }

    public AnimalEventResponse toResponse(AnimalEvent event) {
        return new AnimalEventResponse(
                event.getEventId(),
                event.getAnimal().getUuid(),
                event.getType(),
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

    public Map<String, Object> toPullItem(AnimalEvent event) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", event.getOperationId().toString());
        item.put("animalUuid", event.getAnimal().getUuid().toString());
        item.put("type", event.getType().name());
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
            throw new IllegalStateException("Could not deserialize animal event metadata.", exception);
        }
    }

    public String normalizeSourceChannel(String sourceChannel) {
        String normalized = requireText(sourceChannel, "ANIMAL_EVENT_SOURCE_CHANNEL_REQUIRED").toUpperCase();
        if (!"ONLINE".equals(normalized) && !"OFFLINE".equals(normalized)) {
            throw new IllegalArgumentException("ANIMAL_EVENT_SOURCE_CHANNEL_INVALID");
        }
        return normalized;
    }

    private void validateMetadata(AnimalEventType type, Map<String, Object> metadata) {
        if (type == AnimalEventType.TRANSFERRED) {
            requireUuid(metadata.get("fromOwnerGanaderoId"), "ANIMAL_EVENT_TRANSFER_FROM_OWNER_REQUIRED");
            requireUuid(metadata.get("toOwnerGanaderoId"), "ANIMAL_EVENT_TRANSFER_TO_OWNER_REQUIRED");
        }
    }

    public String writeMetadataJson(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not serialize animal event metadata.", exception);
        }
    }

    private AnimalEventType readType(Object rawType) {
        String value = requireText(rawType, "ANIMAL_EVENT_TYPE_REQUIRED");
        try {
            return AnimalEventType.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("ANIMAL_EVENT_TYPE_INVALID");
        }
    }

    private Map<String, Object> readMetadata(Object rawMetadata) {
        if (rawMetadata == null) {
            return Map.of();
        }
        if (!(rawMetadata instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("ANIMAL_EVENT_METADATA_INVALID");
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        map.forEach((key, value) -> normalized.put(String.valueOf(key), value));
        return normalized;
    }

    private java.time.OffsetDateTime requireOffsetDateTime(Object value, String errorCode) {
        String text = requireText(value, errorCode);
        try {
            return java.time.OffsetDateTime.parse(text);
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

    private String readOptionalText(Object value) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException("ANIMAL_EVENT_NOTES_INVALID");
        }
        String normalized = text.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
