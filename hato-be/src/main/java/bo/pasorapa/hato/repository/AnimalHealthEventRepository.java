package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalHealthEventRepository implements PanacheRepositoryBase<AnimalHealthEvent, UUID> {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public AnimalHealthEventRepository(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Optional<AnimalHealthEvent> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public List<AnimalHealthEvent> listHistory(
            UUID animalUuid,
            AnimalHealthEventType healthEventType,
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo,
            String visitId) {
        StringBuilder query = new StringBuilder("from AnimalHealthEvent where animal.uuid = ?1");
        java.util.List<Object> params = new java.util.ArrayList<>();
        params.add(animalUuid);

        if (healthEventType != null) {
            query.append(" and healthEventType = ?").append(params.size() + 1);
            params.add(healthEventType);
        }
        if (occurredFrom != null) {
            query.append(" and occurredAt >= ?").append(params.size() + 1);
            params.add(occurredFrom);
        }
        if (occurredTo != null) {
            query.append(" and occurredAt <= ?").append(params.size() + 1);
            params.add(occurredTo);
        }

        query.append(" order by occurredAt asc, clientCreatedAt asc, operationId asc");
        List<AnimalHealthEvent> items = find(query.toString(), params.toArray()).list();
        if (visitId == null || visitId.isBlank()) {
            return items;
        }
        return items.stream().filter(event -> visitId.equals(readVisitId(event.getMetadataJson()))).toList();
    }

    public List<AnimalHealthEvent> listByTreatmentCase(UUID animalUuid, String treatmentCaseId) {
        return listHistory(animalUuid, null, null, null, null).stream()
                .filter(event -> treatmentCaseId.equals(readFlatText(event.getMetadataJson(), "treatmentCaseId")))
                .toList();
    }

    public List<AnimalHealthEvent> listByVisit(UUID animalUuid, String visitId, LocalDateTime occurredFrom, LocalDateTime occurredTo) {
        return listHistory(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, occurredFrom, occurredTo, visitId);
    }

    public List<AnimalHealthEvent> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from AnimalHealthEvent order by updatedAt asc, eventId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from AnimalHealthEvent where updatedAt > ?1 or (updatedAt = ?1 and eventId > ?2) order by updatedAt asc, eventId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }

    public List<AnimalHealthEvent> findUpcomingVisits(UUID ganaderoId, int limit) {
        return find(
                        "from AnimalHealthEvent where animal.ownerGanadero.id = ?1 and healthEventType = ?2 order by occurredAt asc, eventId asc",
                        ganaderoId,
                        AnimalHealthEventType.FIELD_VET_VISIT)
                .page(0, limit)
                .list();
    }

    public VetVisitQueryResult findFieldVetVisitsByOwner(UUID ownerId, VetVisitQuery filter) {
        StringBuilder query = new StringBuilder(
                "from AnimalHealthEvent event join fetch event.animal animal where event.healthEventType = ?1");
        List<Object> params = new ArrayList<>();
        params.add(AnimalHealthEventType.FIELD_VET_VISIT);

        if (ownerId != null) {
            query.append(" and animal.ownerGanadero.id = ?").append(params.size() + 1);
            params.add(ownerId);
        }
        if (filter.animalUuid() != null) {
            query.append(" and animal.uuid = ?").append(params.size() + 1);
            params.add(filter.animalUuid());
        }
        if (filter.occurredFrom() != null) {
            query.append(" and event.occurredAt >= ?").append(params.size() + 1);
            params.add(filter.occurredFrom());
        }
        if (filter.occurredTo() != null) {
            query.append(" and event.occurredAt <= ?").append(params.size() + 1);
            params.add(filter.occurredTo());
        }
        query.append(" order by event.occurredAt desc, event.eventId desc");

        List<AnimalHealthEvent> filtered = find(query.toString(), params.toArray()).list().stream()
                .filter(event -> matchesVisitMetadata(event, filter))
                .sorted(Comparator.comparing(AnimalHealthEvent::getOccurredAt).reversed()
                        .thenComparing(AnimalHealthEvent::getEventId))
                .toList();

        int fromIndex = Math.min(filter.offset(), filtered.size());
        int toIndex = Math.min(fromIndex + filter.limit(), filtered.size());
        return new VetVisitQueryResult(filtered.subList(fromIndex, toIndex), filtered.size());
    }

    public List<HealthActivityRow> listHealthActivity(
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo,
            AnimalHealthEventType type,
            UUID ganaderoId,
            UUID animalUuid,
            int limit) {
        StringBuilder query = new StringBuilder(
                """
                select new bo.pasorapa.hato.repository.AnimalHealthEventRepository$HealthActivityRow(
                    event.eventId,
                    event.occurredAt,
                    event.healthEventType,
                    ganadero.id,
                    ganadero.name,
                    animal.uuid,
                    animal.code,
                    animal.tag,
                    event.notes
                )
                from AnimalHealthEvent event
                join event.animal animal
                join animal.ownerGanadero ganadero
                where event.occurredAt >= ?1 and event.occurredAt <= ?2
                """);
        List<Object> params = new ArrayList<>();
        params.add(occurredFrom);
        params.add(occurredTo);
        if (type != null) {
            query.append(" and event.healthEventType = ?").append(params.size() + 1);
            params.add(type);
        }
        if (ganaderoId != null) {
            query.append(" and ganadero.id = ?").append(params.size() + 1);
            params.add(ganaderoId);
        }
        if (animalUuid != null) {
            query.append(" and animal.uuid = ?").append(params.size() + 1);
            params.add(animalUuid);
        }
        query.append(" order by event.occurredAt desc, event.eventId desc");

        var typedQuery = getEntityManager().createQuery(query.toString(), HealthActivityRow.class);
        for (int index = 0; index < params.size(); index++) {
            typedQuery.setParameter(index + 1, params.get(index));
        }
        return typedQuery.setMaxResults(limit).getResultList();
    }

    public record HealthActivityRow(
            UUID eventId,
            LocalDateTime occurredAt,
            AnimalHealthEventType type,
            UUID ganaderoId,
            String ganaderoName,
            UUID animalUuid,
            String animalCode,
            String animalTag,
            String notes) {}

    public record VetVisitQuery(
            UUID animalUuid,
            String visitId,
            String mode,
            String status,
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo,
            int limit,
            int offset) {}

    public record VetVisitQueryResult(List<AnimalHealthEvent> items, long total) {}

    private boolean matchesVisitMetadata(AnimalHealthEvent event, VetVisitQuery filter) {
        Map<String, Object> visit = readVisit(event.getMetadataJson());
        return matchesText(filter.visitId(), visit.get("visitId"))
                && matchesText(filter.mode(), visit.get("mode"))
                && matchesText(filter.status(), visit.get("status"));
    }

    private boolean matchesText(String expected, Object actual) {
        if (expected == null || expected.isBlank()) {
            return true;
        }
        return actual instanceof String text && expected.trim().equalsIgnoreCase(text.trim());
    }

    private Map<String, Object> readVisit(String metadataJson) {
        Object visit = readMetadata(metadataJson).get("visit");
        if (!(visit instanceof Map<?, ?> visitMap)) {
            return Map.of();
        }
        Map<String, Object> normalized = new java.util.LinkedHashMap<>();
        visitMap.forEach((key, value) -> normalized.put(String.valueOf(key), value));
        return normalized;
    }

    private String readVisitId(String metadataJson) {
        Object value = readVisit(metadataJson).get("visitId");
        return value instanceof String text && !text.isBlank() ? text.trim() : null;
    }

    private String readFlatText(String metadataJson, String key) {
        Object value = readMetadata(metadataJson).get(key);
        return value instanceof String text && !text.isBlank() ? text.trim() : null;
    }

    private Map<String, Object> readMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(metadataJson, MAP_TYPE);
        } catch (Exception exception) {
            return Map.of();
        }
    }
}
