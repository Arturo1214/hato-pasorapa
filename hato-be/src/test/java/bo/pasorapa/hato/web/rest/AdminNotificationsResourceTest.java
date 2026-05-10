package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
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
class AdminNotificationsResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("root-admin", Role.ADMIN, "RootAdmin9"));
            userRepository.persist(buildUser("campo-a", Role.GANADERO, "CampoUser9"));
            userRepository.persist(buildUser("campo-b", Role.GANADERO, "CampoUser8"));
        });
    }

    @Test
    void shouldCreateAdminNotificationsIdempotentlyAndListNewestFirst() {
        String token = loginAs("root-admin", "RootAdmin9");
        String ganaderoAId = currentUserIdFor("campo-a");
        String ganaderoBId = currentUserIdFor("campo-b");
        String operationId = UUID.randomUUID().toString();

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", operationId)
                .body("""
                        {
                          "title": "Primer aviso",
                          "body": "Revisar potrero norte.",
                          "targetingMode": "EXPLICIT_LIST",
                          "includeUserIds": ["%s", "%s"],
                          "excludeUserIds": []
                        }
                        """.formatted(ganaderoAId, ganaderoBId))
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(201)
                .body("recipientCount", equalTo(2));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", operationId)
                .body("""
                        {
                          "title": "Primer aviso",
                          "body": "Revisar potrero norte.",
                          "targetingMode": "EXPLICIT_LIST",
                          "includeUserIds": ["%s", "%s"],
                          "excludeUserIds": []
                        }
                        """.formatted(ganaderoAId, ganaderoBId))
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(200)
                .body("recipientCount", equalTo(2));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "title": "Segundo aviso",
                          "body": "Leído solo en este dispositivo.",
                          "targetingMode": "ALL_ACTIVE_GANADEROS",
                          "includeUserIds": [],
                          "excludeUserIds": []
                        }
                        """)
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(201)
                .body("recipientCount", equalTo(2));

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/notifications")
                .then()
                .statusCode(200)
                .body("notifications", hasSize(2))
                .body("notifications[0].title", equalTo("Segundo aviso"))
                .body("notifications[0].deliveryMetrics.totalCount", equalTo(2))
                .body("notifications[0].deliveryMetrics.readCount", equalTo(0))
                .body("notifications[0].deliveryMetrics.pendingCount", equalTo(2))
                .body("notifications[1].title", equalTo("Primer aviso"));
    }

    @Test
    void shouldRejectGanaderoAccessToAdminNotificationsEndpoints() {
        String token = loginAs("campo-a", "CampoUser9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/notifications")
                .then()
                .statusCode(403);

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "title": "Sin permiso",
                          "body": "No debería crear nada.",
                          "targetingMode": "ALL_ACTIVE_GANADEROS",
                          "includeUserIds": [],
                          "excludeUserIds": []
                        }
                        """)
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(403);
    }

    @Test
    void shouldRejectInvalidNotificationPayload() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "title": "",
                          "body": " ",
                          "targetingMode": null,
                          "includeUserIds": [],
                          "excludeUserIds": []
                        }
                        """)
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(400)
                .body("title", equalTo("Constraint Violation"))
                .body("violations", hasSize(3));
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

    private String currentUserIdFor(String username) {
        return QuarkusTransaction.requiringNew().call(() -> userRepository.findByUsernameOrEmail(username).orElseThrow().getId().toString());
    }

    private User buildUser(String username, Role role, String password) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(username + "@hato.bo");
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
