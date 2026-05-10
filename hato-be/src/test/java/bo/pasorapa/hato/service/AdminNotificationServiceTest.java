package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.notifications.AdminNotificationCreateRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminNotificationServiceTest {

    private static final UUID ADMIN_ID = UUID.fromString("2e33c48c-86bf-45ab-9d50-5ae7d57fc590");
    private static final UUID GANADERO_A = UUID.fromString("d85e7fbb-b6dc-4f1c-bd05-f2ab318576f6");
    private static final UUID GANADERO_B = UUID.fromString("80d2f909-43f2-476d-9b9d-923fe86704ab");
    private static final UUID GANADERO_C = UUID.fromString("bf74ca20-a22d-4ee5-b565-b8c214bf4db2");

    @Inject
    AdminNotificationService adminNotificationService;

    @Inject
    AdminNotificationRepository adminNotificationRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser(ADMIN_ID, "root-admin", Role.ADMIN, UserStatus.ACTIVE));
            userRepository.persist(buildUser(GANADERO_A, "ganadero-a", Role.GANADERO, UserStatus.ACTIVE));
            userRepository.persist(buildUser(GANADERO_B, "ganadero-b", Role.GANADERO, UserStatus.ACTIVE));
            userRepository.persist(buildUser(GANADERO_C, "ganadero-c", Role.GANADERO, UserStatus.INACTIVE));
        });
    }

    @Test
    void shouldCreateCanonicalNotificationForAllActiveGanaderosAndAuditIt() {
        var created = adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Vacunación",
                        "Revisar stock esta tarde.",
                        AdminNotificationTargetingMode.ALL_ACTIVE_GANADEROS,
                        List.of(),
                        List.of(GANADERO_B)),
                UUID.fromString("6b7d3c31-e3d9-4cba-a74d-f88a9be7810a"),
                ADMIN_ID);

        List<AdminNotificationRecipient> recipients = QuarkusTransaction.requiringNew().call(() -> adminNotificationRepository
                .getEntityManager()
                .createQuery("from AdminNotificationRecipient order by recipientUserId asc", AdminNotificationRecipient.class)
                .getResultList());

        assertEquals(false, created.replayed());
        assertEquals(1, created.data().recipientCount());
        assertEquals("ALL_ACTIVE_GANADEROS", created.data().targetingMode());
        assertEquals(List.of(GANADERO_B.toString()), created.data().excludeUserIds());
        assertEquals(List.of(GANADERO_A), recipients.stream().map(AdminNotificationRecipient::getRecipientUserId).toList());
        assertEquals(1, operationLogRepository.count());
    }

    @Test
    void shouldResolveExplicitRecipientsWithExclusionPrecedence() {
        var created = adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Aviso puntual",
                        "Solo dos destinatarios finales.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(GANADERO_A, GANADERO_B),
                        List.of(GANADERO_B)),
                UUID.fromString("4d4fccf1-9da0-4056-a7d7-f11d1912bd84"),
                ADMIN_ID);

        List<AdminNotificationRecipient> recipients = QuarkusTransaction.requiringNew().call(() -> adminNotificationRepository
                .getEntityManager()
                .createQuery("from AdminNotificationRecipient order by recipientUserId asc", AdminNotificationRecipient.class)
                .getResultList());

        assertEquals(1, created.data().recipientCount());
        assertEquals(List.of(GANADERO_A.toString(), GANADERO_B.toString()), created.data().includeUserIds());
        assertEquals(List.of(GANADERO_B.toString()), created.data().excludeUserIds());
        assertEquals(List.of(GANADERO_A), recipients.stream().map(AdminNotificationRecipient::getRecipientUserId).toList());
    }

    @Test
    void shouldListIssuedNotificationsWithDeliveryMetrics() {
        var created = adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Lectura de potreros",
                        "Confirmar recepción.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(GANADERO_A, GANADERO_B),
                        List.of()),
                UUID.fromString("c3f6c2e1-59df-48aa-b493-7ee1f3c4d901"),
                ADMIN_ID);

        QuarkusTransaction.requiringNew().run(() -> adminNotificationRepository
                .getEntityManager()
                .createQuery("from AdminNotificationRecipient where notification.id = :notificationId", AdminNotificationRecipient.class)
                .setParameter("notificationId", UUID.fromString(created.data().id()))
                .setMaxResults(1)
                .getSingleResult()
                .setRead(true));

        var listed = adminNotificationService.listIssuedNotifications().notifications().getFirst();

        assertEquals(created.data().id(), listed.id());
        assertEquals(2, listed.deliveryMetrics().totalCount());
        assertEquals(1, listed.deliveryMetrics().readCount());
        assertEquals(1, listed.deliveryMetrics().pendingCount());
    }

    @Test
    void shouldReturnOwnedInboxNewestFirstAndUnreadCount() {
        var older = adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Aviso antiguo",
                        "Primero.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(GANADERO_A),
                        List.of()),
                UUID.fromString("a8eff98f-3c90-4cfc-a8cd-e36814963001"),
                ADMIN_ID);
        var newer = adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Aviso reciente",
                        "Segundo.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(GANADERO_A),
                        List.of()),
                UUID.fromString("a8eff98f-3c90-4cfc-a8cd-e36814963002"),
                ADMIN_ID);
        adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Ajeno",
                        "No debe aparecer.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(GANADERO_B),
                        List.of()),
                UUID.fromString("a8eff98f-3c90-4cfc-a8cd-e36814963003"),
                ADMIN_ID);

        adminNotificationService.markRecipientAsRead(recipientIdForNotification(older.data().id()), GANADERO_A);

        var inbox = adminNotificationService.getInbox(GANADERO_A);

        assertEquals(2, inbox.items().size());
        assertEquals(newer.data().id(), inbox.items().get(0).id());
        assertEquals(older.data().id(), inbox.items().get(1).id());
        assertEquals(false, inbox.items().get(0).read());
        assertEquals(true, inbox.items().get(1).read());
        assertNotNull(inbox.items().get(1).readAt());
        assertEquals(1, adminNotificationService.getUnreadCount(GANADERO_A).unreadCount());
    }

    @Test
    void shouldSetUpdatedAtWhenMarkingRecipientAsRead() {
        var created = adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Lectura con fecha",
                        "Debe tocar updatedAt.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        List.of(GANADERO_A),
                        List.of()),
                UUID.fromString("d959a527-57e8-437a-b0e8-5232e8ddbe01"),
                ADMIN_ID);
        UUID recipientId = recipientIdForNotification(created.data().id());
        LocalDateTime beforeRead = recipientUpdatedAt(recipientId);

        adminNotificationService.markRecipientAsRead(recipientId, GANADERO_A);

        LocalDateTime afterRead = recipientUpdatedAt(recipientId);
        assertTrue(afterRead.isAfter(beforeRead));
    }

    @Test
    void shouldRejectExplicitTargetingOverTheV1RecipientLimit() {
        List<UUID> tooManyRecipients = java.util.stream.IntStream.range(0, 201)
                .mapToObj(index -> UUID.nameUUIDFromBytes(("recipient-" + index).getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .toList();

        BusinessException exception = assertThrows(BusinessException.class, () -> adminNotificationService.create(
                new AdminNotificationCreateRequest(
                        "Límite",
                        "Debe rechazar la lista demasiado grande.",
                        AdminNotificationTargetingMode.EXPLICIT_LIST,
                        tooManyRecipients,
                        List.of()),
                UUID.fromString("69bfcf71-f8e0-43a0-b42d-1b689b55bf0a"),
                ADMIN_ID));

        assertEquals("ADMIN_NOTIFICATION_EXPLICIT_RECIPIENT_LIMIT_EXCEEDED", exception.code());
    }

    private User buildUser(UUID id, String username, Role role, UserStatus status) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(username + "@hato.bo");
        user.setDisplayName(username);
        user.setPasswordHash("hash");
        user.setRole(role);
        user.setStatus(status);
        user.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
        user.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
        return user;
    }

    private UUID recipientIdForNotification(String notificationId) {
        return QuarkusTransaction.requiringNew().call(() -> adminNotificationRepository
                .getEntityManager()
                .createQuery("from AdminNotificationRecipient where notification.id = :notificationId", AdminNotificationRecipient.class)
                .setParameter("notificationId", UUID.fromString(notificationId))
                .setMaxResults(1)
                .getSingleResult()
                .getId());
    }

    private LocalDateTime recipientUpdatedAt(UUID recipientId) {
        return QuarkusTransaction.requiringNew().call(() -> adminNotificationRepository
                .getEntityManager()
                .find(AdminNotificationRecipient.class, recipientId)
                .getUpdatedAt());
    }
}
