package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalEventLogRepository implements PanacheRepositoryBase<AnimalEventLog, UUID> {

    public List<AnimalEventLog> findByAnimalUuidOrderByOccurredAtDesc(UUID animalUuid) {
        return find("from AnimalEventLog log left join fetch log.animal animal where animal.uuid = ?1 order by log.occurredAt desc, log.eventId desc", animalUuid).list();
    }

    public List<AnimalEventLog> findByEventCategory(AnimalEventCategory eventCategory, Page page) {
        return find("eventCategory = ?1 order by updatedAt asc, eventId asc", eventCategory).page(page).list();
    }

    public Optional<AnimalEventLog> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public Optional<AnimalEventLog> findByEventIdOrOperationId(AnimalEventCategory category, UUID eventUuid) {
        return find("eventCategory = ?1 and (eventId = ?2 or operationId = ?2)", category, eventUuid).firstResultOptional();
    }

    public List<AnimalEventLog> listGeneralHistory(UUID animalUuid, AnimalEventType eventType, LocalDateTime occurredFrom, LocalDateTime occurredTo) {
        StringBuilder query = new StringBuilder("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and animal.uuid = ?2");
        List<Object> params = new ArrayList<>();
        params.add(AnimalEventCategory.GENERAL);
        params.add(animalUuid);
        if (eventType != null) {
            query.append(" and log.eventType = ?").append(params.size() + 1);
            params.add(eventType.name());
        }
        if (occurredFrom != null) {
            query.append(" and log.occurredAt >= ?").append(params.size() + 1);
            params.add(occurredFrom);
        }
        if (occurredTo != null) {
            query.append(" and log.occurredAt <= ?").append(params.size() + 1);
            params.add(occurredTo);
        }
        query.append(" order by log.occurredAt asc, log.createdAt asc, log.eventId asc");
        return find(query.toString(), params.toArray()).list();
    }

    public List<AnimalEventLog> findUpcomingGeneralForGanadero(UUID ganaderoId, LocalDateTime since, int limit) {
        return find(
                        "from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and animal.ownerGanadero.id = ?2 and log.occurredAt >= ?3 order by log.occurredAt asc, log.eventId asc",
                        AnimalEventCategory.GENERAL,
                        ganaderoId,
                        since)
                .page(0, limit)
                .list();
    }

    public List<AnimalEventLog> listHealthHistory(
            UUID animalUuid,
            AnimalHealthEventType healthEventType,
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo,
            String visitId) {
        StringBuilder query = new StringBuilder("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and animal.uuid = ?2");
        List<Object> params = new ArrayList<>();
        params.add(AnimalEventCategory.HEALTH);
        params.add(animalUuid);
        if (healthEventType != null) {
            query.append(" and log.eventType = ?").append(params.size() + 1);
            params.add(healthEventType.name());
        }
        if (occurredFrom != null) {
            query.append(" and log.occurredAt >= ?").append(params.size() + 1);
            params.add(occurredFrom);
        }
        if (occurredTo != null) {
            query.append(" and log.occurredAt <= ?").append(params.size() + 1);
            params.add(occurredTo);
        }
        if (visitId != null && !visitId.isBlank()) {
            query.append(" and log.visitId = ?").append(params.size() + 1);
            params.add(visitId);
        }
        query.append(" order by log.occurredAt asc, log.clientCreatedAt asc, log.operationId asc");
        return find(query.toString(), params.toArray()).list();
    }

    public List<AnimalEventLog> listHealthByTreatmentCase(UUID animalUuid, String treatmentCaseId) {
        if (treatmentCaseId == null || treatmentCaseId.isBlank()) {
            return List.of();
        }
        return find(
                        "from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and animal.uuid = ?2 and log.metadataJson like ?3 order by log.occurredAt asc, log.clientCreatedAt asc, log.operationId asc",
                        AnimalEventCategory.HEALTH,
                        animalUuid,
                        "%\"treatmentCaseId\":\"" + treatmentCaseId.trim() + "\"%")
                .list();
    }

    public List<AnimalEventLog> listHealthByVisit(UUID animalUuid, String visitId, LocalDateTime occurredFrom, LocalDateTime occurredTo) {
        return listHealthHistory(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, occurredFrom, occurredTo, visitId);
    }

    public List<AnimalEventLog> findUpcomingHealthVisits(UUID ganaderoId, int limit) {
        return find(
                        "from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and log.eventType = ?2 and animal.ownerGanadero.id = ?3 order by log.occurredAt asc, log.eventId asc",
                        AnimalEventCategory.HEALTH,
                        "FIELD_VET_VISIT",
                        ganaderoId)
                .page(0, limit)
                .list();
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
                select new bo.pasorapa.hato.repository.AnimalEventLogRepository$HealthActivityRow(
                    log.eventId,
                    log.occurredAt,
                    log.eventType,
                    ganadero.id,
                    ganadero.name,
                    animal.uuid,
                    animal.code,
                    animal.tag,
                    log.notes
                )
                from AnimalEventLog log
                join log.animal animal
                join animal.ownerGanadero ganadero
                where log.eventCategory = ?1 and log.occurredAt >= ?2 and log.occurredAt <= ?3
                """);
        List<Object> params = new ArrayList<>();
        params.add(AnimalEventCategory.HEALTH);
        params.add(occurredFrom);
        params.add(occurredTo);
        if (type != null) {
            query.append(" and log.eventType = ?").append(params.size() + 1);
            params.add(type.name());
        }
        if (ganaderoId != null) {
            query.append(" and ganadero.id = ?").append(params.size() + 1);
            params.add(ganaderoId);
        }
        if (animalUuid != null) {
            query.append(" and animal.uuid = ?").append(params.size() + 1);
            params.add(animalUuid);
        }
        query.append(" order by log.occurredAt desc, log.eventId desc");

        var typedQuery = getEntityManager().createQuery(query.toString(), HealthActivityRow.class);
        for (int index = 0; index < params.size(); index++) {
            typedQuery.setParameter(index + 1, params.get(index));
        }
        return typedQuery.setMaxResults(limit).getResultList();
    }

    public List<AnimalEventLog> findGeneralByAnimalUuidForProjection(UUID animalUuid) {
        return find(
                        "from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and animal.uuid = ?2 order by log.occurredAt asc, log.clientCreatedAt asc, log.operationId asc",
                        AnimalEventCategory.GENERAL,
                        animalUuid)
                .list();
    }

    public List<AnimalEventLog> listReproductionHistory(
            UUID animalUuid,
            AnimalReproductionEventType reproductionEventType,
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo) {
        StringBuilder query = new StringBuilder("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and animal.uuid = ?2");
        List<Object> params = new ArrayList<>();
        params.add(AnimalEventCategory.REPRODUCTION);
        params.add(animalUuid);
        if (reproductionEventType != null) {
            query.append(" and log.eventType = ?").append(params.size() + 1);
            params.add(reproductionEventType.name());
        }
        if (occurredFrom != null) {
            query.append(" and log.occurredAt >= ?").append(params.size() + 1);
            params.add(occurredFrom);
        }
        if (occurredTo != null) {
            query.append(" and log.occurredAt <= ?").append(params.size() + 1);
            params.add(occurredTo);
        }
        query.append(" order by log.occurredAt desc, log.clientCreatedAt desc, log.operationId desc");
        return find(query.toString(), params.toArray()).list();
    }

    public List<AnimalEventLog> listChangedSince(AnimalEventCategory category, LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        return listChangedSinceForOwner(category, null, cursorUpdatedAt, cursorId, limitPlusOne);
    }

    public List<AnimalEventLog> listChangedSinceForOwner(AnimalEventCategory category, UUID ownerGanaderoId, LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        StringBuilder query = new StringBuilder("from AnimalEventLog log left join fetch log.animal animal");
        List<Object> params = new ArrayList<>();
        appendChangedSinceWhere(query, params, category, ownerGanaderoId, cursorUpdatedAt, cursorId);
        query.append(" order by log.updatedAt asc, log.eventId asc");
        return find(query.toString(), params.toArray()).page(0, limitPlusOne).list();
    }

    public List<AnimalEventLog> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        return listChangedSinceForOwner(null, null, cursorUpdatedAt, cursorId, limitPlusOne);
    }

    private void appendChangedSinceWhere(StringBuilder query, List<Object> params, AnimalEventCategory category, UUID ownerGanaderoId, LocalDateTime cursorUpdatedAt, UUID cursorId) {
        if (category == null && ownerGanaderoId == null && cursorUpdatedAt == null) {
            return;
        }

        query.append(" where ");
        if (category != null) {
            query.append("log.eventCategory = ?").append(params.size() + 1);
            params.add(category);
        }
        if (ownerGanaderoId != null) {
            if (!params.isEmpty()) {
                query.append(" and ");
            }
            query.append("animal.ownerGanadero.id = ?").append(params.size() + 1);
            params.add(ownerGanaderoId);
        }
        if (cursorUpdatedAt != null) {
            if (!params.isEmpty()) {
                query.append(" and ");
            }
            UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
            query.append("(log.updatedAt > ?").append(params.size() + 1)
                    .append(" or (log.updatedAt = ?").append(params.size() + 1)
                    .append(" and log.eventId > ?").append(params.size() + 2).append("))");
            params.add(cursorUpdatedAt);
            params.add(effectiveCursorId);
        }
    }

    public List<AnimalEventLog> findByVisitIdRoot(String visitId) {
        if (visitId == null || visitId.isBlank()) {
            return List.of();
        }
        return latestPerVisit(find("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and log.eventType = ?2 and log.visitId = ?3 order by log.occurredAt asc, log.eventId asc",
                AnimalEventCategory.HEALTH,
                "FIELD_VET_VISIT",
                visitId).list());
    }

    public List<AnimalEventLog> findByParentVisitId(String parentVisitId) {
        if (parentVisitId == null || parentVisitId.isBlank()) {
            return List.of();
        }
        return latestPerVisit(find("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and log.eventType = ?2 and log.parentVisitId = ?3 order by log.occurredAt asc, log.eventId asc",
                AnimalEventCategory.HEALTH,
                "FIELD_VET_VISIT",
                parentVisitId).list()).stream()
                .sorted(Comparator.comparing(AnimalEventLog::getOccurredAt).thenComparing(AnimalEventLog::getEventId))
                .toList();
    }

    public VetVisitQueryResult findVetVisitsByAnimal(UUID animalUuid, String estado, String modo, UUID veterinarianId, LocalDateTime from, LocalDateTime to, Page page) {
        StringBuilder query = new StringBuilder("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and log.eventType = ?2");
        List<Object> params = new ArrayList<>();
        params.add(AnimalEventCategory.HEALTH);
        params.add("FIELD_VET_VISIT");
        if (animalUuid != null) {
            query.append(" and animal.uuid = ?").append(params.size() + 1);
            params.add(animalUuid);
        }
        if (estado != null && !estado.isBlank()) {
            query.append(" and lower(log.visitStatus) in ?").append(params.size() + 1);
            params.add(visitStatusAliases(estado));
        }
        if (modo != null && !modo.isBlank()) {
            query.append(" and lower(log.metadataJson) like ?").append(params.size() + 1);
            params.add("%\"mode\":\"" + modo.trim().toLowerCase() + "\"%");
        }
        if (from != null) {
            query.append(" and log.occurredAt >= ?").append(params.size() + 1);
            params.add(from);
        }
        if (to != null) {
            query.append(" and log.occurredAt <= ?").append(params.size() + 1);
            params.add(to);
        }
        query.append(" order by log.occurredAt desc, log.eventId desc");
        List<AnimalEventLog> grouped = latestPerVisit(find(query.toString(), params.toArray()).list());
        int fromIndex = Math.min(page.index * page.size, grouped.size());
        int toIndex = Math.min(fromIndex + page.size, grouped.size());
        return new VetVisitQueryResult(grouped.subList(fromIndex, toIndex), grouped.size());
    }

    public List<AnimalEventLog> findFieldVetVisitsByOwner(UUID ownerId, VetVisitQuery filter) {
        StringBuilder query = new StringBuilder("from AnimalEventLog log left join fetch log.animal animal where log.eventCategory = ?1 and log.eventType = ?2");
        List<Object> params = new ArrayList<>();
        params.add(AnimalEventCategory.HEALTH);
        params.add("FIELD_VET_VISIT");
        if (ownerId != null) {
            query.append(" and animal.ownerGanadero.id = ?").append(params.size() + 1);
            params.add(ownerId);
        }
        if (filter.animalUuid() != null) {
            query.append(" and animal.uuid = ?").append(params.size() + 1);
            params.add(filter.animalUuid());
        }
        if (filter.visitId() != null && !filter.visitId().isBlank()) {
            query.append(" and log.visitId = ?").append(params.size() + 1);
            params.add(filter.visitId());
        }
        if (filter.mode() != null && !filter.mode().isBlank()) {
            query.append(" and lower(log.metadataJson) like ?").append(params.size() + 1);
            params.add("%\"mode\":\"" + filter.mode().trim().toLowerCase() + "\"%");
        }
        if (filter.status() != null && !filter.status().isBlank()) {
            query.append(" and lower(log.visitStatus) in ?").append(params.size() + 1);
            params.add(visitStatusAliases(filter.status()));
        }
        if (filter.occurredFrom() != null) {
            query.append(" and log.occurredAt >= ?").append(params.size() + 1);
            params.add(filter.occurredFrom());
        }
        if (filter.occurredTo() != null) {
            query.append(" and log.occurredAt <= ?").append(params.size() + 1);
            params.add(filter.occurredTo());
        }
        query.append(" order by log.occurredAt desc, log.eventId desc");
        return find(query.toString(), params.toArray()).list();
    }

    private List<AnimalEventLog> latestPerVisit(List<AnimalEventLog> logs) {
        Map<String, AnimalEventLog> latest = new LinkedHashMap<>();
        for (AnimalEventLog log : logs) {
            String key = log.getVisitId() == null ? log.getEventId().toString() : log.getVisitId();
            AnimalEventLog current = latest.get(key);
            if (current == null || compareLifecycle(log, current) > 0) {
                latest.put(key, log);
            }
        }
        return latest.values().stream()
                .sorted(Comparator.comparing(AnimalEventLog::getOccurredAt).reversed().thenComparing(AnimalEventLog::getEventId))
                .toList();
    }

    private int compareLifecycle(AnimalEventLog left, AnimalEventLog right) {
        return Comparator.comparingInt(this::lifecycleRank)
                .thenComparing(AnimalEventLog::getOccurredAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AnimalEventLog::getClientCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AnimalEventLog::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AnimalEventLog::getEventId, Comparator.nullsFirst(Comparator.naturalOrder()))
                .compare(left, right);
    }

    private int lifecycleRank(AnimalEventLog log) {
        String status = canonicalVisitStatus(log.getVisitStatus());
        if ("canceled".equals(status)) return 40;
        if ("attended".equals(status) || "finalized".equals(status) || "CLOSED".equalsIgnoreCase(log.getProtocolStatus())) return 30;
        if ("rescheduled".equals(status)) return 20;
        return 10;
    }

    private List<String> visitStatusAliases(String status) {
        return switch (canonicalVisitStatus(status)) {
            case "pending" -> List.of("pending", "programada", "scheduled");
            case "attended" -> List.of("attended", "atendida");
            case "canceled" -> List.of("canceled", "cancelada", "cancelled");
            case "rescheduled" -> List.of("rescheduled", "reprogramada");
            case "finalized" -> List.of("finalized", "finalizada");
            default -> List.of(status.trim().toLowerCase());
        };
    }

    private String canonicalVisitStatus(String status) {
        if (status == null || status.isBlank()) {
            return "";
        }

        return switch (status.trim().toLowerCase()) {
            case "programada", "scheduled", "pending" -> "pending";
            case "atendida", "attended" -> "attended";
            case "cancelada", "cancelled", "canceled" -> "canceled";
            case "reprogramada", "rescheduled" -> "rescheduled";
            case "finalizada", "finalized" -> "finalized";
            default -> status.trim().toLowerCase();
        };
    }

    public record VetVisitQueryResult(List<AnimalEventLog> items, long total) {}

    public record VetVisitQuery(
            UUID animalUuid,
            String visitId,
            String mode,
            String status,
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo,
            int limit,
            int offset) {}

    public record HealthActivityRow(
            UUID eventId,
            LocalDateTime occurredAt,
            String type,
            UUID ganaderoId,
            String ganaderoName,
            UUID animalUuid,
            String animalCode,
            String animalTag,
            String notes) {}
}
