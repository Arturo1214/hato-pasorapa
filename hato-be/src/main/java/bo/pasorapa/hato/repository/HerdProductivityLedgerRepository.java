package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.HerdProductivityLedger;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class HerdProductivityLedgerRepository implements PanacheRepositoryBase<HerdProductivityLedger, UUID> {

    public Optional<HerdProductivityLedger> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public Optional<HerdProductivityLedger> findByIdentityKey(String identityKey) {
        return find("identityKey", identityKey).firstResultOptional();
    }

    public List<HerdProductivityLedger> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from HerdProductivityLedger order by updatedAt asc, entryId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from HerdProductivityLedger where updatedAt > ?1 or (updatedAt = ?1 and entryId > ?2) order by updatedAt asc, entryId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
