package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.SyncOperationReceipt;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

@ApplicationScoped
public class SyncOperationReceiptRepository implements PanacheRepositoryBase<SyncOperationReceipt, UUID> {
}
