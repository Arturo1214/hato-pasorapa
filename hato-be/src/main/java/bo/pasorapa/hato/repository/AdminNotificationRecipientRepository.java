package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AdminNotificationRecipientRepository implements PanacheRepositoryBase<AdminNotificationRecipient, UUID> {

    public long countByRecipientUserIdAndReadFalse(UUID recipientUserId) {
        return count("recipientUserId = ?1 and read = false", recipientUserId);
    }

    public Optional<AdminNotificationRecipient> findByIdWithNotification(UUID recipientId) {
        return getEntityManager()
                .createQuery(
                        """
                        select recipient
                        from AdminNotificationRecipient recipient
                        join fetch recipient.notification
                        where recipient.id = :recipientId
                        """,
                        AdminNotificationRecipient.class)
                .setParameter("recipientId", recipientId)
                .getResultStream()
                .findFirst();
    }

    public List<AdminNotificationRecipient> getOwnedInbox(UUID recipientUserId) {
        return getEntityManager()
                .createQuery(
                        """
                        select recipient
                        from AdminNotificationRecipient recipient
                        join fetch recipient.notification notification
                        where recipient.recipientUserId = :recipientUserId
                        order by notification.publishedAt desc, notification.id desc
                        """,
                        AdminNotificationRecipient.class)
                .setParameter("recipientUserId", recipientUserId)
                .getResultList();
    }

    public List<NotificationRecipientMetricsRow> getGroupedMetrics() {
        return getEntityManager()
                .createQuery(
                        """
                        select new bo.pasorapa.hato.repository.AdminNotificationRecipientRepository$NotificationRecipientMetricsRow(
                            recipient.notification.id,
                            count(recipient),
                            sum(case when recipient.read = true then 1 else 0 end)
                        )
                        from AdminNotificationRecipient recipient
                        group by recipient.notification.id
                        """,
                        NotificationRecipientMetricsRow.class)
                .getResultList();
    }

    public long markAllAsReadForUser(UUID recipientUserId) {
        return update("read = true, updatedAt = CURRENT_TIMESTAMP where recipientUserId = ?1 and read = false", recipientUserId);
    }

    public record NotificationRecipientMetricsRow(UUID notificationId, long totalCount, long readCount) {
        public int pendingCount() {
            return Math.toIntExact(totalCount - readCount);
        }
    }
}
