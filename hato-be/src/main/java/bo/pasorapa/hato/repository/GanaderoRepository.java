package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.Ganadero;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class GanaderoRepository implements PanacheRepositoryBase<Ganadero, UUID> {

    public Optional<Ganadero> findByBusinessIdentifier(String businessIdentifier) {
        return find("lower(businessIdentifier) = ?1", businessIdentifier.toLowerCase()).firstResultOptional();
    }

    public Optional<Ganadero> findByEmail(String email) {
        return find("lower(email) = ?1", email.toLowerCase()).firstResultOptional();
    }

    public List<Ganadero> listByActive(Boolean active) {
        if (active == null) {
            return listAll(io.quarkus.panache.common.Sort.by("createdAt").ascending());
        }

        return find("active", io.quarkus.panache.common.Sort.by("createdAt").ascending(), active).list();
    }

    public List<Ganadero> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from Ganadero order by updatedAt asc, id asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from Ganadero where updatedAt > ?1 or (updatedAt = ?1 and id > ?2) order by updatedAt asc, id asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
