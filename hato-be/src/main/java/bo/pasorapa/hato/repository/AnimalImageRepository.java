package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AnimalImage;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalImageRepository implements PanacheRepositoryBase<AnimalImage, UUID> {

    public Optional<AnimalImage> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public List<AnimalImage> listByAnimalUuid(UUID animalUuid) {
        return find(
                        "from AnimalImage where animal.uuid = ?1 order by capturedAt asc, createdAt asc, imageId asc",
                        animalUuid)
                .list();
    }

    public List<AnimalImage> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from AnimalImage order by updatedAt asc, imageId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from AnimalImage where updatedAt > ?1 or (updatedAt = ?1 and imageId > ?2) order by updatedAt asc, imageId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
