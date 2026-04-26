package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.Ganadero;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class GanaderoRepository implements PanacheRepositoryBase<Ganadero, UUID> {

    public Optional<Ganadero> findByBusinessIdentifier(String businessIdentifier) {
        return find("lower(businessIdentifier) = ?1", businessIdentifier.toLowerCase()).firstResultOptional();
    }

    public List<Ganadero> listByActive(Boolean active) {
        if (active == null) {
            return listAll(io.quarkus.panache.common.Sort.by("createdAt").ascending());
        }

        return find("active", io.quarkus.panache.common.Sort.by("createdAt").ascending(), active).list();
    }
}
