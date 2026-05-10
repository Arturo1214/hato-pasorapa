package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("admin", "admin@hato.bo", Role.ADMIN, UserStatus.ACTIVE, "Admin123"));
            userRepository.persist(buildUser("ganadero@hato.bo", "ganadero@hato.bo", Role.GANADERO, UserStatus.ACTIVE, "Ganadero9"));
            userRepository.persist(buildUser("inactivo", "inactive@hato.bo", Role.GANADERO, UserStatus.INACTIVE, "Inactive99"));
            userRepository.persist(buildUser("bloqueado", "blocked@hato.bo", Role.ADMIN, UserStatus.BLOCKED, "Blocked99"));

            Ganadero ganadero = new Ganadero();
            ganadero.setBusinessIdentifier("12345678");
            ganadero.setName("Ganadero Norte");
            ganadero.setEmail("ganadero@hato.bo");
            ganaderoRepository.persist(ganadero);
        });
    }

    @Test
    void shouldLoginAdminWithDatabaseCredentials() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "admin",
                          "password": "Admin123"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("accessToken", org.hamcrest.Matchers.not(org.hamcrest.Matchers.blankOrNullString()))
                .body("expiresInSeconds", equalTo(28800))
                .body("user.username", equalTo("admin"))
                .body("user.role", equalTo("ADMIN"))
                .body("user.status", equalTo("ACTIVE"));
    }

    @Test
    void shouldLoginGanaderoWithDatabaseCredentials() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "ganadero@hato.bo",
                          "password": "Ganadero9"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("user.username", equalTo("ganadero@hato.bo"))
                .body("user.role", equalTo("GANADERO"));
    }

    @Test
    void shouldLoginGanaderoWithBusinessIdentifier() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "12345678",
                          "password": "Ganadero9"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("user.username", equalTo("ganadero@hato.bo"))
                .body("user.role", equalTo("GANADERO"));
    }

    @Test
    void shouldRejectInvalidCredentials() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "admin",
                          "password": "bad-password"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("code", equalTo("INVALID_CREDENTIALS"));
    }

    @Test
    void shouldRejectUnknownIdentifierWithGenericError() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "99999999",
                          "password": "Ganadero9"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("code", equalTo("INVALID_CREDENTIALS"));
    }

    @Test
    void shouldRejectBlockedAccount() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "bloqueado",
                          "password": "Blocked99"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("code", equalTo("ACCOUNT_BLOCKED"));
    }

    @Test
    void shouldRejectInactiveAccountWithUnauthorizedStatus() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "inactivo",
                          "password": "Inactive99"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("code", equalTo("ACCOUNT_INACTIVE"));
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
