package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.security.PasswordHasher;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class NotificationRecipientsResourceTest {

    private static final UUID USER_ID = UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce3001");

    @Inject UserRepository userRepository;
    @Inject PasswordHasher passwordHasher;
    @Inject AdminNotificationRepository adminNotificationRepository;
    @Inject AdminNotificationRecipientRepository adminNotificationRecipientRepository;
    @Inject IntegrationDatabaseCleaner integrationDatabaseCleaner;

    private UUID recipientId;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("notif-ganadero", USER_ID, Role.GANADERO, "Ganadero9"));
            userRepository.persist(buildUser("notif-admin", UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce3999"), Role.ADMIN, "RootAdmin9"));
            recipientId = seedRecipient(USER_ID, UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce3111"));
            seedRecipient(USER_ID, UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce3222"));
        });
    }

    @Test
    void shouldMarkRecipientAndAllNotificationsAsRead() {
        String token = loginAs("notif-ganadero", "Ganadero9");

        given().auth().oauth2(token).when().patch("/api/notifications/recipients/{id}/read", recipientId).then()
                .statusCode(200)
                .body("message", equalTo("Notificación marcada como leída."));

        given().auth().oauth2(token).when().patch("/api/notifications/recipients/read").then()
                .statusCode(200)
                .body("message", equalTo("Notificaciones marcadas como leídas."));
    }

    private UUID seedRecipient(UUID userId, UUID notificationId) {
        AdminNotification notification = new AdminNotification();
        notification.setId(notificationId);
        notification.setTitle("Aviso " + notificationId);
        notification.setBody("Mensaje");
        notification.setTargetingMode(AdminNotificationTargetingMode.EXPLICIT_LIST);
        notification.setRecipientCount(1);
        notification.setCreatedByUserId(UUID.fromString("67f0af67-f6db-4bb0-aeb1-56cfb2ce3999"));
        adminNotificationRepository.persist(notification);

        AdminNotificationRecipient recipient = new AdminNotificationRecipient();
        recipient.setNotification(notification);
        recipient.setRecipientUserId(userId);
        recipient.setRead(false);
        adminNotificationRecipientRepository.persist(recipient);
        return recipient.getId();
    }

    private String loginAs(String username, String password) {
        return given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "%s",
                          "password": "%s"
                        }
                        """.formatted(username, password))
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .extract()
                .path("accessToken");
    }

    private User buildUser(String username, UUID id, Role role, String password) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(username + "@hato.bo");
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
