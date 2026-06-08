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
        return listChangedSinceForOwner(null, cursorUpdatedAt, cursorId, limitPlusOne);
    }

    public List<AnimalImage> listChangedSinceForOwner(UUID ownerGanaderoId, LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        StringBuilder query = new StringBuilder("from AnimalImage image left join fetch image.animal animal");
        java.util.List<Object> params = new java.util.ArrayList<>();
        if (ownerGanaderoId != null || cursorUpdatedAt != null) {
            query.append(" where ");
            if (ownerGanaderoId != null) {
                query.append("animal.ownerGanadero.id = ?").append(params.size() + 1);
                params.add(ownerGanaderoId);
            }
            if (cursorUpdatedAt != null) {
                if (!params.isEmpty()) {
                    query.append(" and ");
                }
                UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
                query.append("(image.updatedAt > ?").append(params.size() + 1)
                        .append(" or (image.updatedAt = ?").append(params.size() + 1)
                        .append(" and image.imageId > ?").append(params.size() + 2).append("))");
                params.add(cursorUpdatedAt);
                params.add(effectiveCursorId);
            }
        }
        query.append(" order by image.updatedAt asc, image.imageId asc");
        return find(query.toString(), params.toArray()).page(0, limitPlusOne).list();
    }
}
