package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.UserStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
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

    public List<UUID> listActiveGanaderoUserIds() {
        return find("role = ?1 and status = ?2 order by createdAt asc", Role.GANADERO, UserStatus.ACTIVE)
                .stream()
                .map(User::getId)
                .toList();
    }

    public List<UUID> listActiveGanaderoUserIdsByIds(List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }

        return find("id in ?1 and role = ?2 and status = ?3", userIds, Role.GANADERO, UserStatus.ACTIVE)
                .stream()
                .map(User::getId)
                .toList();
    }

    public long countByRole(bo.pasorapa.hato.domain.Role role) {
        return count("role", role);
    }

    public long countByRoleAndStatus(bo.pasorapa.hato.domain.Role role, UserStatus status) {
        return count("role = ?1 and status = ?2", role, status);
    }

    public List<User> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from User order by updatedAt asc, id asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from User where updatedAt > ?1 or (updatedAt = ?1 and id > ?2) order by updatedAt asc, id asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }
}
