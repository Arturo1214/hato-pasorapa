package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

    public List<Animal> listOffspringByParentUuid(UUID parentUuid) {
        return list("motherAnimalUuid = ?1 or fatherAnimalUuid = ?1", parentUuid);
    }

    public List<Animal> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorUuid, int limitPlusOne) {
        return listChangedSinceForOwner(null, cursorUpdatedAt, cursorUuid, limitPlusOne);
    }

    public List<Animal> listChangedSinceForOwner(UUID ownerGanaderoId, LocalDateTime cursorUpdatedAt, UUID cursorUuid, int limitPlusOne) {
        StringBuilder query = new StringBuilder("from Animal");
        List<Object> params = new ArrayList<>();
        appendChangedSinceWhere(query, params, ownerGanaderoId, cursorUpdatedAt, cursorUuid);
        query.append(" order by updatedAt asc, uuid asc");
        return find(query.toString(), params.toArray()).page(0, limitPlusOne).list();
    }

    private void appendChangedSinceWhere(StringBuilder query, List<Object> params, UUID ownerGanaderoId, LocalDateTime cursorUpdatedAt, UUID cursorUuid) {
        if (ownerGanaderoId == null && cursorUpdatedAt == null) {
            return;
        }

        query.append(" where ");
        if (ownerGanaderoId != null) {
            query.append("ownerGanadero.id = ?").append(params.size() + 1);
            params.add(ownerGanaderoId);
        }
        if (cursorUpdatedAt != null) {
            if (!params.isEmpty()) {
                query.append(" and ");
            }
            UUID effectiveCursorUuid = cursorUuid == null ? new UUID(0L, 0L) : cursorUuid;
            query.append("(updatedAt > ?").append(params.size() + 1)
                    .append(" or (updatedAt = ?").append(params.size() + 1)
                    .append(" and uuid > ?").append(params.size() + 2).append("))");
            params.add(cursorUpdatedAt);
            params.add(effectiveCursorUuid);
        }
    }

    public long countByOwnerAndSexAndCategory(UUID ganaderoId, AnimalSex sex, AnimalCategory category) {
        return count("ownerGanadero.id = ?1 and sex = ?2 and category = ?3", ganaderoId, sex, category);
    }

    public List<InventoryCountRow> listInventoryByGanadero(UUID ganaderoId, Boolean active) {
        StringBuilder query = new StringBuilder(
                """
                select new bo.pasorapa.hato.repository.AnimalRepository$InventoryCountRow(
                    ganadero.id,
                    ganadero.name,
                    animal.category,
                    animal.sex,
                    animal.active,
                    count(animal)
                )
                from Animal animal
                join animal.ownerGanadero ganadero
                """);
        List<Object> params = new ArrayList<>();
        if (ganaderoId != null || active != null) {
            query.append(" where ");
        }
        if (ganaderoId != null) {
            query.append("ganadero.id = ?").append(params.size() + 1);
            params.add(ganaderoId);
        }
        if (active != null) {
            if (!params.isEmpty()) {
                query.append(" and ");
            }
            query.append("animal.active = ?").append(params.size() + 1);
            params.add(active);
        }
        query.append(
                """
                 group by ganadero.id, ganadero.name, animal.category, animal.sex, animal.active
                 order by ganadero.name asc, ganadero.id asc, animal.category asc, animal.sex asc, animal.active desc
                """);
        var typedQuery = getEntityManager().createQuery(query.toString(), InventoryCountRow.class);
        for (int index = 0; index < params.size(); index++) {
            typedQuery.setParameter(index + 1, params.get(index));
        }
        return typedQuery.getResultList();
    }

    public record InventoryCountRow(
            UUID ganaderoId,
            String ganaderoName,
            AnimalCategory category,
            AnimalSex sex,
            Boolean active,
            long count) {}
}
