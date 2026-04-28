package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class AdminNotificationRepository implements PanacheRepositoryBase<AdminNotification, UUID> {

    public List<AdminNotification> listIssuedNotifications() {
        return find("from AdminNotification order by publishedAt desc, id desc").list();
    }

    public List<AdminNotificationRecipient> listChangedSinceForRecipient(
            UUID recipientUserId,
            LocalDateTime cursorUpdatedAt,
            UUID cursorId,
            int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return getEntityManager()
                    .createQuery(
                            """
                            select recipient
                            from AdminNotificationRecipient recipient
                            join fetch recipient.notification notification
                            where recipient.recipientUserId = :recipientUserId
                            order by recipient.updatedAt asc, notification.id asc
                            """,
                            AdminNotificationRecipient.class)
                    .setParameter("recipientUserId", recipientUserId)
                    .setMaxResults(limitPlusOne)
                    .getResultList();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return getEntityManager()
                .createQuery(
                        """
                        select recipient
                        from AdminNotificationRecipient recipient
                        join fetch recipient.notification notification
                        where recipient.recipientUserId = :recipientUserId
                          and (recipient.updatedAt > :cursorUpdatedAt
                               or (recipient.updatedAt = :cursorUpdatedAt and notification.id > :cursorId))
                        order by recipient.updatedAt asc, notification.id asc
                        """,
                        AdminNotificationRecipient.class)
                .setParameter("recipientUserId", recipientUserId)
                .setParameter("cursorUpdatedAt", cursorUpdatedAt)
                .setParameter("cursorId", effectiveCursorId)
                .setMaxResults(limitPlusOne)
                .getResultList();
    }
}
