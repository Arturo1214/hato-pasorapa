package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventResponse;
import bo.pasorapa.hato.service.model.AnimalHealthEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class AnimalHealthEventMapper {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final Set<String> FIELD_VET_PROTOCOL_STATUSES = Set.of("STARTED", "FOLLOW_UP_REQUIRED", "CLOSED");
    private static final Set<String> FIELD_VET_VISIT_MODES = Set.of("GLOBAL", "SPECIFIC", "ESPECIFICA");
    private static final Set<String> FIELD_VET_VISIT_STATUSES = Set.of(
            "PROGRAMADA", "ATENDIDA", "REPROGRAMADA", "FINALIZADA", "CANCELADA",
            "PENDING", "ATTENDED", "RESCHEDULED", "FINALIZED", "CANCELED");
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

    public AnimalEventLog toAnimalEventLog(AnimalHealthEvent event) {
        AnimalEventLog log = new AnimalEventLog();
        log.setEventId(event.getEventId());
        log.setAnimal(event.getAnimal());
        log.setEventCategory(AnimalEventCategory.HEALTH);
        log.setEventType(validateHealthEventType(event.getHealthEventType().name()).name());
        log.setOccurredAt(event.getOccurredAt());
        log.setClientCreatedAt(event.getClientCreatedAt());
        log.setNotes(event.getNotes());
        log.setPerformedByUserId(event.getPerformedByUserId());
        log.setSourceChannel(event.getSourceChannel());
        log.setOperationId(event.getOperationId());
        log.setMetadataJson(event.getMetadataJson());
        log.setCreatedAt(event.getCreatedAt());
        log.setUpdatedAt(event.getUpdatedAt());
        applyVetProjection(log, readMetadataJson(event.getMetadataJson()));
        return log;
    }

    public AnimalEventLog toAnimalEventLog(Animal animal, AnimalHealthEventRequest request, UUID effectivePerformedByUserId) {
        AnimalEventLog log = new AnimalEventLog();
        log.setAnimal(animal);
        log.setEventCategory(AnimalEventCategory.HEALTH);
        log.setEventType(validateHealthEventType(request.healthEventType().name()).name());
        log.setOccurredAt(request.occurredAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        log.setClientCreatedAt(request.clientCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
        log.setNotes(request.notes());
        log.setPerformedByUserId(effectivePerformedByUserId);
        log.setSourceChannel(request.sourceChannel());
        log.setOperationId(request.operationId());
        log.setMetadataJson(writeMetadataJson(request.metadata()));
        applyVetProjection(log, request.metadata());
        return log;
    }

    public AnimalHealthEvent toAnimalHealthEvent(AnimalEventLog log) {
        if (log.getEventCategory() != AnimalEventCategory.HEALTH) {
            throw new IllegalArgumentException("ANIMAL_EVENT_LOG_CATEGORY_INVALID_FOR_HEALTH");
        }
        AnimalHealthEvent event = new AnimalHealthEvent();
        event.setEventId(log.getEventId());
        event.setAnimal(log.getAnimal());
        event.setHealthEventType(validateHealthEventType(log.getEventType()));
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

    public AnimalHealthEventResponse toAnimalHealthEventDto(AnimalEventLog log) {
        return toResponse(toAnimalHealthEvent(log), log.getVisitId(), null, log.getNextDueAt() == null ? null : log.getNextDueAt().atOffset(ZoneOffset.UTC));
    }

    public AnimalHealthEventType validateHealthEventType(String eventType) {
        try {
            return AnimalHealthEventType.valueOf(eventType);
        } catch (Exception exception) {
            throw new IllegalArgumentException("ANIMAL_EVENT_LOG_HEALTH_TYPE_INVALID");
        }
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
        rejectOutOfScopeAttachments(type, metadata);

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

    public String readFieldVetVisitStatus(Map<String, Object> metadata) {
        Map<String, Object> visit = readOptionalMap(metadata.get("visit"));
        return visit == null ? null : readOptionalText(visit.get("status"));
    }

    public Map<String, Object> readCost(Map<String, Object> metadata) {
        Map<String, Object> cost = readOptionalMap(metadata.get("cost"));
        return cost == null ? null : cost;
    }

    public List<String> readTreatmentPlan(Map<String, Object> metadata) {
        Map<String, Object> clinicalNote = readOptionalMap(metadata.get("clinicalNote"));
        if (clinicalNote != null && clinicalNote.get("plan") != null) {
            return readPlanDescriptions(clinicalNote.get("plan"), "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_INVALID");
        }
        if (metadata.get("treatmentPlan") != null) {
            return readOrderedTreatmentPlan(metadata.get("treatmentPlan"));
        }
        return null;
    }

    public String readCancelReason(Map<String, Object> metadata) {
        Map<String, Object> visit = readOptionalMap(metadata.get("visit"));
        String visitReason = visit == null ? null : readOptionalText(visit.get("cancelReason"));
        return visitReason == null ? readOptionalText(metadata.get("cancelReason")) : visitReason;
    }

    public OffsetDateTime readNextDueAt(Map<String, Object> metadata) {
        Map<String, Object> visit = readOptionalMap(metadata.get("visit"));
        if (visit != null && visit.get("nextControlAt") != null) {
            return requireOffsetDateTime(visit.get("nextControlAt"), "ANIMAL_HEALTH_EVENT_VET_VISIT_NEXT_CONTROL_AT_INVALID");
        }
        Map<String, Object> protocol = readOptionalMap(metadata.get("protocol"));
        if (protocol != null && protocol.get("nextDueAt") != null) {
            return requireOffsetDateTime(protocol.get("nextDueAt"), "ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_INVALID");
        }
        if (metadata.get("nextDueAt") != null) {
            return requireOffsetDateTime(metadata.get("nextDueAt"), "ANIMAL_HEALTH_EVENT_NEXT_DUE_AT_INVALID");
        }
        return null;
    }

    private void applyVetProjection(AnimalEventLog log, Map<String, Object> metadata) {
        if (!AnimalHealthEventType.FIELD_VET_VISIT.name().equals(log.getEventType())) {
            return;
        }
        Map<String, Object> visit = readOptionalMap(metadata.get("visit"));
        log.setVisitId(visit == null ? null : readOptionalText(visit.get("visitId")));
        log.setParentVisitId(visit == null ? null : readOptionalText(visit.get("parentVisitId")));
        log.setVisitStatus(visit == null ? null : readOptionalText(visit.get("status")));
        log.setProtocolStatus(readFieldVetProtocolStatus(metadata));
        OffsetDateTime nextDueAt = readNextDueAt(metadata);
        log.setNextDueAt(nextDueAt == null ? null : nextDueAt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
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

    private void rejectOutOfScopeAttachments(AnimalHealthEventType type, Map<String, Object> metadata) {
        boolean containsUnsupportedField = collectMetadataKeys(metadata).stream().anyMatch(key -> key.contains("attachment")
                || key.contains("image")
                || key.contains("multimedia")
                || key.contains("billing")
                || (key.contains("cost") && type != AnimalHealthEventType.FIELD_VET_VISIT)
                || key.contains("costo")
                || key.contains("price")
                || ("amount".equals(key) && type != AnimalHealthEventType.FIELD_VET_VISIT)
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
        String mode = requireText(visit.get("mode"), "ANIMAL_HEALTH_EVENT_VET_VISIT_MODE_REQUIRED").toUpperCase();
        if (!FIELD_VET_VISIT_MODES.contains(mode)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_VISIT_MODE_INVALID");
        }
        String visitStatus = requireText(visit.get("status"), "ANIMAL_HEALTH_EVENT_VET_VISIT_STATUS_REQUIRED").toUpperCase();
        if (!FIELD_VET_VISIT_STATUSES.contains(visitStatus)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_VISIT_STATUS_INVALID");
        }
        if ("CANCELED".equals(visitStatus) || "CANCELADA".equals(visitStatus)) {
            requireTextBetween(readCancelReason(metadata), 5, 500, "ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED");
        }
        Map<String, Object> veterinarian = requireMap(visit.get("veterinarian"), "ANIMAL_HEALTH_EVENT_VET_VISIT_VETERINARIAN_REQUIRED");
        requireText(veterinarian.get("name"), "ANIMAL_HEALTH_EVENT_VET_VISIT_VETERINARIAN_NAME_REQUIRED");
        readOptionalText(veterinarian.get("license"));
        String visitAttentionNotes = readOptionalText(visit.get("atencionNotas"));
        String metadataAttentionNotes = readOptionalText(metadata.get("atencionNotas"));
        if (("ATTENDED".equals(visitStatus) || "ATENDIDA".equals(visitStatus))
                && visitAttentionNotes == null
                && metadataAttentionNotes == null) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_ATTENTION_NOTES_REQUIRED");
        }
        readOptionalText(visit.get("parentVisitId"));
        if (visit.get("targetAnimalCount") != null && !(visit.get("targetAnimalCount") instanceof Number)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_VISIT_TARGET_ANIMAL_COUNT_INVALID");
        }
        if (visit.get("nextControlAt") != null) {
            requireOffsetDateTime(visit.get("nextControlAt"), "ANIMAL_HEALTH_EVENT_VET_VISIT_NEXT_CONTROL_AT_INVALID");
        }

        List<Map<String, Object>> checklist = requireListOfMaps(metadata.get("checklist"), "ANIMAL_HEALTH_EVENT_VET_CHECKLIST_REQUIRED");
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
        String findings = readOptionalText(clinicalNote.get("findings"));
        if (("ATTENDED".equals(visitStatus) || "ATENDIDA".equals(visitStatus) || "FINALIZED".equals(visitStatus) || "FINALIZADA".equals(visitStatus))
                && findings == null) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_FINDINGS_REQUIRED");
        }
        if (clinicalNote.get("plan") != null) {
            readPlanDescriptions(clinicalNote.get("plan"), "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_INVALID");
        }
        if (metadata.get("treatmentPlan") != null) {
            readOrderedTreatmentPlan(metadata.get("treatmentPlan"));
        }
        if (metadata.get("cost") != null) {
            validateCost(metadata.get("cost"));
        }

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

    private void validateCost(Object rawCost) {
        Map<String, Object> cost = requireMap(rawCost, "ANIMAL_HEALTH_EVENT_VET_COST_INVALID");
        Object amount = cost.get("amount");
        if (!(amount instanceof Number number) || !isFinite(number) || BigDecimal.valueOf(number.doubleValue()).compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_COST_AMOUNT_INVALID");
        }
        String currency = requireText(cost.get("currency"), "ANIMAL_HEALTH_EVENT_VET_COST_CURRENCY_REQUIRED");
        if (!"BOB".equals(currency)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_COST_CURRENCY_INVALID");
        }
    }

    private boolean isFinite(Number number) {
        if (number instanceof Double doubleValue) {
            return Double.isFinite(doubleValue);
        }
        if (number instanceof Float floatValue) {
            return Float.isFinite(floatValue);
        }
        return true;
    }

    private List<String> readPlanDescriptions(Object value, String errorCode) {
        if (value instanceof String text) {
            String normalized = requireText(text, "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_DESCRIPTION_REQUIRED");
            return List.of(normalized);
        }
        if (!(value instanceof Iterable<?> iterable)) {
            throw new IllegalArgumentException(errorCode);
        }
        List<String> steps = new ArrayList<>();
        for (Object item : iterable) {
            String description = requireText(item, "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_DESCRIPTION_REQUIRED");
            requireMaxLength(description, 300, "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_DESCRIPTION_TOO_LONG");
            steps.add(description);
        }
        validateTreatmentPlanSize(steps.size());
        return steps;
    }

    private List<String> readOrderedTreatmentPlan(Object value) {
        List<Map<String, Object>> steps = requireListOfMaps(value, "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_INVALID");
        validateTreatmentPlanSize(steps.size());
        return steps.stream()
                .sorted(Comparator.comparingInt(this::readTreatmentPlanOrder))
                .map(step -> {
                    String description = requireText(step.get("description"), "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_DESCRIPTION_REQUIRED");
                    requireMaxLength(description, 300, "ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_DESCRIPTION_TOO_LONG");
                    return description;
                })
                .toList();
    }

    private int readTreatmentPlanOrder(Map<String, Object> step) {
        if (!(step.get("order") instanceof Number number)) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_STEP_ORDER_REQUIRED");
        }
        return number.intValue();
    }

    private void validateTreatmentPlanSize(int size) {
        if (size > 20) {
            throw new IllegalArgumentException("ANIMAL_HEALTH_EVENT_VET_TREATMENT_PLAN_TOO_LONG");
        }
    }

    private String requireTextBetween(String value, int minLength, int maxLength, String errorCode) {
        String text = requireText(value, errorCode);
        if (text.length() < minLength || text.length() > maxLength) {
            throw new IllegalArgumentException(errorCode);
        }
        return text;
    }

    private void requireMaxLength(String value, int maxLength, String errorCode) {
        if (value.length() > maxLength) {
            throw new IllegalArgumentException(errorCode);
        }
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
