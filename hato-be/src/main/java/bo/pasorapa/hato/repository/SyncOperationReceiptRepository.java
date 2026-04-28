package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.SyncOperationReceipt;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class SyncOperationReceiptRepository implements PanacheRepositoryBase<SyncOperationReceipt, UUID> {

    public List<SyncOperationReceipt> listConflictCandidates() {
        return list("classification = ?1 or classification = ?2", "version_conflict", "validation_error");
    }

    public List<SyncOperationReceipt> listByWindow(LocalDateTime since) {
        return list("createdAt >= ?1 order by createdAt desc, operationId desc", since);
    }
}
