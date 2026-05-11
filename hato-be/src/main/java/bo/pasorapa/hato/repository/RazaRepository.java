package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.Raza;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class RazaRepository implements PanacheRepositoryBase<Raza, Long> {

    public Optional<Raza> findByUuid(UUID uuid) {
        return find("uuid", uuid).firstResultOptional();
    }

    public Optional<Raza> findByNombreIgnoreCase(String nombre) {
        return find("lower(nombre) = ?1", nombre.toLowerCase()).firstResultOptional();
    }

    public Optional<Raza> findByNombreNormalizado(String nombreNormalizado) {
        return find("nombreNormalizado", nombreNormalizado).firstResultOptional();
    }

    public List<Raza> findAllActiveOrdered() {
        return list("activo = true order by sortOrder asc, nombre asc");
    }

    public List<Raza> findAllOrdered() {
        return list("order by sortOrder asc, nombre asc");
    }
}
