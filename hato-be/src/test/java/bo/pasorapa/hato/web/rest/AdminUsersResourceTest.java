package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminUsersResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("root-admin", "root-admin@hato.bo", Role.ADMIN, UserStatus.ACTIVE, "RootAdmin9"));
            userRepository.persist(buildUser("campo-user", "campo@hato.bo", Role.GANADERO, UserStatus.ACTIVE, "CampoUser9"));
        });
    }

    @Test
    void shouldCreateAdminUserIdempotentlyAndListIt() {
        String token = loginAs("root-admin", "RootAdmin9");
        String operationId = UUID.randomUUID().toString();

        Response created = given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", operationId)
                .body("""
                        {
                          "username": "gestion-admin",
                          "email": "gestion-admin@hato.bo",
                          "displayName": "Gestión Admin",
                          "role": "ADMIN",
                          "password": "Gestion99"
                        }
                        """)
                .when()
                .post("/api/admin/users")
                .then()
                .statusCode(201)
                .body("username", equalTo("gestion-admin"))
                .body("role", equalTo("ADMIN"))
                .body("status", equalTo("ACTIVE"))
                .extract()
                .response();

        String createdId = created.path("id");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", operationId)
                .body("""
                        {
                          "username": "gestion-admin",
                          "email": "gestion-admin@hato.bo",
                          "displayName": "Gestión Admin",
                          "role": "ADMIN",
                          "password": "Gestion99"
                        }
                        """)
                .when()
                .post("/api/admin/users")
                .then()
                .statusCode(200)
                .body("id", equalTo(createdId))
                .body("role", equalTo("ADMIN"));

        given()
                .auth().oauth2(token)
                .queryParam("status", "ACTIVE")
                .when()
                .get("/api/admin/users")
                .then()
                .statusCode(200)
                .body("users", hasSize(3))
                .body("users[2].username", equalTo("gestion-admin"));

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(3, userRepository.count());
            assertEquals(1, operationLogRepository.count());
        });
    }

    @Test
    void shouldDisableManagedUserAndRejectFutureLogin() {
        User managedUser = QuarkusTransaction.requiringNew().call(() -> {
            User user = buildUser("managed-admin", "managed-admin@hato.bo", Role.ADMIN, UserStatus.ACTIVE, "Managed99");
            userRepository.persist(user);
            userRepository.flush();
            return user;
        });

        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "status": "INACTIVE"
                        }
                        """)
                .when()
                .put("/api/admin/users/{id}/status", managedUser.getId())
                .then()
                .statusCode(200)
                .body("status", equalTo("INACTIVE"));

        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "managed-admin",
                          "password": "Managed99"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(403)
                .body("code", equalTo("ACCOUNT_INACTIVE"));
    }

    @Test
    void shouldUpdateManagedUserProfileAndRejectInvalidPayload() {
        User managedUser = QuarkusTransaction.requiringNew().call(() -> {
            User user = buildUser("managed-admin", "managed-admin@hato.bo", Role.ADMIN, UserStatus.ACTIVE, "Managed99");
            user.setDisplayName("Managed Admin");
            userRepository.persist(user);
            userRepository.flush();
            return user;
        });

        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "username": "managed-admin-updated",
                          "email": "managed-admin-updated@hato.bo",
                          "displayName": "Managed Admin Updated",
                          "role": "GANADERO"
                        }
                        """)
                .when()
                .put("/api/admin/users/{id}", managedUser.getId())
                .then()
                .statusCode(200)
                .body("username", equalTo("managed-admin-updated"))
                .body("email", equalTo("managed-admin-updated@hato.bo"))
                .body("displayName", equalTo("Managed Admin Updated"))
                .body("role", equalTo("GANADERO"));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "username": "",
                          "email": "correo-invalido",
                          "displayName": "",
                          "role": null
                        }
                        """)
                .when()
                .put("/api/admin/users/{id}", managedUser.getId())
                .then()
                .statusCode(400);
    }

    @Test
    void shouldResetPasswordAndRejectOldCredentials() {
        User managedUser = QuarkusTransaction.requiringNew().call(() -> {
            User user = buildUser("reset-admin", "reset-admin@hato.bo", Role.ADMIN, UserStatus.ACTIVE, "Original99");
            userRepository.persist(user);
            userRepository.flush();
            return user;
        });

        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "password": "Renovada99"
                        }
                        """)
                .when()
                .put("/api/admin/users/{id}/password", managedUser.getId())
                .then()
                .statusCode(200)
                .body("message", equalTo("Contraseña actualizada correctamente."));

        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "reset-admin",
                          "password": "Original99"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("code", equalTo("INVALID_CREDENTIALS"));

        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "reset-admin",
                          "password": "Renovada99"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("accessToken", not(blankOrNullString()));
    }

    @Test
    void shouldRejectGanaderoAccessToAdministrativeUsersEndpoints() {
        String token = loginAs("campo-user", "CampoUser9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/users")
                .then()
                .statusCode(403);
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

    private User buildUser(String username, String email, Role role, UserStatus status, String password) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(status);
        return user;
    }
}
