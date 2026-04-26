package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class UserRepository implements PanacheRepositoryBase<User, UUID> {

    public Optional<User> findByUsernameOrEmail(String identifier) {
        return find("lower(username) = ?1 or lower(email) = ?1", identifier.toLowerCase()).firstResultOptional();
    }

    public boolean hasActiveAdmin() {
        return count("role = ?1 and status = ?2", bo.pasorapa.hato.domain.Role.ADMIN, UserStatus.ACTIVE) > 0;
    }

    public boolean existsByUsernameIgnoreCase(String username) {
        return count("lower(username) = ?1", username.toLowerCase()) > 0;
    }

    public boolean existsByEmailIgnoreCase(String email) {
        return count("lower(email) = ?1", email.toLowerCase()) > 0;
    }

    public List<User> listByStatus(UserStatus status) {
        if (status == null) {
            return listAll(io.quarkus.panache.common.Sort.by("createdAt").ascending());
        }

        return find("status", io.quarkus.panache.common.Sort.by("createdAt").ascending(), status).list();
    }

    public long countByRole(bo.pasorapa.hato.domain.Role role) {
        return count("role", role);
    }

    public long countByRoleAndStatus(bo.pasorapa.hato.domain.Role role, UserStatus status) {
        return count("role = ?1 and status = ?2", role, status);
    }
}
