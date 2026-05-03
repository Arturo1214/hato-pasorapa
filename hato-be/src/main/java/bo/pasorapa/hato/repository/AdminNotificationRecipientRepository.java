package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AdminNotificationRecipientRepository implements PanacheRepositoryBase<AdminNotificationRecipient, UUID> {

    public long countByRecipientUserIdAndReadFalse(UUID recipientUserId) {
        return count("recipientUserId = ?1 and read = false", recipientUserId);
    }

    public Optional<AdminNotificationRecipient> findOwnedByUser(UUID recipientId, UUID recipientUserId) {
        return find("id = ?1 and recipientUserId = ?2", recipientId, recipientUserId).firstResultOptional();
    }

    public long markAllAsReadForUser(UUID recipientUserId) {
        return update("read = true, updatedAt = CURRENT_TIMESTAMP where recipientUserId = ?1 and read = false", recipientUserId);
    }
}
