package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalEventRepository implements PanacheRepositoryBase<AnimalEvent, UUID> {

    public Optional<AnimalEvent> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public List<AnimalEvent> findByAnimalUuidForProjection(UUID animalUuid) {
        return find(
                        "from AnimalEvent where animal.uuid = ?1 order by occurredAt asc, clientCreatedAt asc, operationId asc",
                        animalUuid)
                .list();
    }

    public List<AnimalEvent> listHistory(UUID animalUuid, AnimalEventType eventType, LocalDateTime occurredFrom, LocalDateTime occurredTo) {
        StringBuilder query = new StringBuilder("from AnimalEvent where animal.uuid = ?1");
        java.util.List<Object> params = new java.util.ArrayList<>();
        params.add(animalUuid);

        if (eventType != null) {
            query.append(" and type = ?").append(params.size() + 1);
            params.add(eventType);
        }
        if (occurredFrom != null) {
            query.append(" and occurredAt >= ?").append(params.size() + 1);
            params.add(occurredFrom);
        }
        if (occurredTo != null) {
            query.append(" and occurredAt <= ?").append(params.size() + 1);
            params.add(occurredTo);
        }
        query.append(" order by occurredAt asc, createdAt asc, eventId asc");
        return find(query.toString(), params.toArray()).list();
    }

    public List<AnimalEvent> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from AnimalEvent order by updatedAt asc, eventId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from AnimalEvent where updatedAt > ?1 or (updatedAt = ?1 and eventId > ?2) order by updatedAt asc, eventId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
