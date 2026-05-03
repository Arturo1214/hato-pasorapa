package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalRepository implements PanacheRepositoryBase<Animal, Long> {

    public Optional<Animal> findByUuid(UUID uuid) {
        return find("uuid", uuid).firstResultOptional();
    }

    public Optional<Animal> findByCode(String code) {
        return find("code", code).firstResultOptional();
    }

    public Optional<Animal> findByTag(String tag) {
        return find("tag", tag).firstResultOptional();
    }

    public Optional<Animal> findByNormalizedArete(String normalizedArete) {
        return find("areteNormalized", normalizedArete.toLowerCase()).firstResultOptional();
    }

    public List<Animal> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorUuid, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from Animal order by updatedAt asc, uuid asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorUuid = cursorUuid == null ? new UUID(0L, 0L) : cursorUuid;
        return find(
                        "from Animal where updatedAt > ?1 or (updatedAt = ?1 and uuid > ?2) order by updatedAt asc, uuid asc",
                        cursorUpdatedAt,
                        effectiveCursorUuid)
                .page(0, limitPlusOne)
                .list();
    }

    public long countByOwnerAndSexAndCategory(UUID ganaderoId, AnimalSex sex, AnimalCategory category) {
        return count("ownerGanadero.id = ?1 and sex = ?2 and category = ?3", ganaderoId, sex, category);
    }
}
