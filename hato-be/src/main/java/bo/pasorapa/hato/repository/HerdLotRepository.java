package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.HerdLot;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class HerdLotRepository implements PanacheRepositoryBase<HerdLot, UUID> {

    public Optional<HerdLot> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public List<HerdLot> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from HerdLot order by updatedAt asc, lotId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from HerdLot where updatedAt > ?1 or (updatedAt = ?1 and lotId > ?2) order by updatedAt asc, lotId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
