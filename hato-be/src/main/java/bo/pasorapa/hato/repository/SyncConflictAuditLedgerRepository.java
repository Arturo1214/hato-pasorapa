package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.SyncConflictAuditLedger;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class SyncConflictAuditLedgerRepository implements PanacheRepository<SyncConflictAuditLedger> {

    public List<SyncConflictAuditLedger> listByOperationId(UUID operationId) {
        return list("operationId = ?1 order by createdAt asc, id asc", operationId);
    }

    public List<SyncConflictAuditLedger> listByWindow(LocalDateTime since) {
        return list("createdAt >= ?1 order by createdAt desc, id desc", since);
    }
}
