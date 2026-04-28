package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalReproductionEventRepository implements PanacheRepositoryBase<AnimalReproductionEvent, UUID> {

    public Optional<AnimalReproductionEvent> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public List<AnimalReproductionEvent> listHistory(
            UUID animalUuid,
            AnimalReproductionEventType reproductionEventType,
            LocalDateTime occurredFrom,
            LocalDateTime occurredTo) {
        StringBuilder query = new StringBuilder("from AnimalReproductionEvent where animal.uuid = ?1");
        List<Object> params = new ArrayList<>();
        params.add(animalUuid);

        if (reproductionEventType != null) {
            query.append(" and reproductionEventType = ?").append(params.size() + 1);
            params.add(reproductionEventType);
        }
        if (occurredFrom != null) {
            query.append(" and occurredAt >= ?").append(params.size() + 1);
            params.add(occurredFrom);
        }
        if (occurredTo != null) {
            query.append(" and occurredAt <= ?").append(params.size() + 1);
            params.add(occurredTo);
        }

        query.append(" order by occurredAt desc, clientCreatedAt desc, operationId desc");
        return find(query.toString(), params.toArray()).list();
    }

    public List<AnimalReproductionEvent> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from AnimalReproductionEvent order by updatedAt asc, eventId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from AnimalReproductionEvent where updatedAt > ?1 or (updatedAt = ?1 and eventId > ?2) order by updatedAt asc, eventId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
