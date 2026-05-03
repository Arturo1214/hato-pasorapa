package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminNotificationReadServiceTest {

    private static final UUID USER_ID = UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce2001");

    @Inject AdminNotificationService adminNotificationService;
    @Inject AdminNotificationRepository adminNotificationRepository;
    @Inject AdminNotificationRecipientRepository adminNotificationRecipientRepository;
    @Inject UserRepository userRepository;
    @Inject IntegrationDatabaseCleaner integrationDatabaseCleaner;

    private UUID unreadRecipientId;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser(UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce2999")));
            userRepository.persist(buildGanaderoUser(USER_ID));
            unreadRecipientId = seedRecipient(false, USER_ID, UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce2111"));
            seedRecipient(false, USER_ID, UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce2222"));
        });
    }

    @Test
    void shouldMarkIndividualRecipientAndAllRecipientsAsRead() {
        assertEquals(2, adminNotificationRecipientRepository.countByRecipientUserIdAndReadFalse(USER_ID));

        adminNotificationService.markRecipientAsRead(unreadRecipientId, USER_ID);
        assertEquals(1, adminNotificationRecipientRepository.countByRecipientUserIdAndReadFalse(USER_ID));

        adminNotificationService.markAllAsReadForUser(USER_ID);
        assertEquals(0, adminNotificationRecipientRepository.countByRecipientUserIdAndReadFalse(USER_ID));
    }

    private UUID seedRecipient(boolean read, UUID userId, UUID notificationId) {
        AdminNotification notification = new AdminNotification();
        notification.setId(notificationId);
        notification.setTitle("Aviso " + notificationId);
        notification.setBody("Mensaje");
        notification.setTargetingMode(AdminNotificationTargetingMode.EXPLICIT_LIST);
        notification.setRecipientCount(1);
        notification.setCreatedByUserId(UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce2999"));
        adminNotificationRepository.persist(notification);

        AdminNotificationRecipient recipient = new AdminNotificationRecipient();
        recipient.setNotification(notification);
        recipient.setRecipientUserId(userId);
        recipient.setRead(read);
        adminNotificationRecipientRepository.persist(recipient);
        return recipient.getId();
    }

    private User buildUser(UUID id) {
        User user = new User();
        user.setId(id);
        user.setUsername("creator-" + id.toString().substring(0, 8));
        user.setEmail("creator-" + id.toString().substring(0, 8) + "@hato.bo");
        user.setDisplayName("creator");
        user.setPasswordHash("hash");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private User buildGanaderoUser(UUID id) {
        User user = new User();
        user.setId(id);
        user.setUsername("ganadero-" + id.toString().substring(0, 8));
        user.setEmail("ganadero-" + id.toString().substring(0, 8) + "@hato.bo");
        user.setDisplayName("ganadero");
        user.setPasswordHash("hash");
        user.setRole(Role.GANADERO);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
