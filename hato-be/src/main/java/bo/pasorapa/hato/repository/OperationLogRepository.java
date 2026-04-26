package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.OperationLog;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class OperationLogRepository implements PanacheRepositoryBase<OperationLog, UUID> {

    public Optional<OperationLog> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }
}
