package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
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
            query.append(" and lower(log.visitStatus) = ?").append(params.size() + 1);
            params.add(estado.trim().toLowerCase());
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

    public List<AnimalEventLog> findFieldVetVisitsByOwner(UUID ownerId, AnimalHealthEventRepository.VetVisitQuery filter) {
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
            query.append(" and lower(log.visitStatus) = ?").append(params.size() + 1);
            params.add(filter.status().trim().toLowerCase());
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
        String status = log.getVisitStatus();
        if ("CANCELADA".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)) return 40;
        if ("ATENDIDA".equalsIgnoreCase(status) || "ATTENDED".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(log.getProtocolStatus())) return 30;
        if ("REPROGRAMADA".equalsIgnoreCase(status) || "RESCHEDULED".equalsIgnoreCase(status)) return 20;
        return 10;
    }

    public record VetVisitQueryResult(List<AnimalEventLog> items, long total) {}
}
