package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.HerdCostLedger;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class HerdCostLedgerRepository implements PanacheRepositoryBase<HerdCostLedger, UUID> {

    public Optional<HerdCostLedger> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public Optional<HerdCostLedger> findByIdentityKey(String identityKey) {
        return find("identityKey", identityKey).firstResultOptional();
    }

    public List<HerdCostLedger> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from HerdCostLedger order by updatedAt asc, entryId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from HerdCostLedger where updatedAt > ?1 or (updatedAt = ?1 and entryId > ?2) order by updatedAt asc, entryId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
