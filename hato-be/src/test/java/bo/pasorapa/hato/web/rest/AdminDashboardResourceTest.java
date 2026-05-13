package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminDashboardResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

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
            userRepository.persist(buildUser("root-admin", Role.ADMIN, UserStatus.ACTIVE, "RootAdmin9"));
            userRepository.persist(buildUser("admin-baja", Role.ADMIN, UserStatus.INACTIVE, "AdminBaja9"));
            userRepository.persist(buildUser("ganadero-activo", Role.GANADERO, UserStatus.ACTIVE, "Ganadero9"));
            ganaderoRepository.persist(buildGanadero("NIT-DASHBOARD-ACTIVO", "ganadero-activo@hato.bo"));
            userRepository.persist(buildUser("ganadero-bloqueado", Role.GANADERO, UserStatus.BLOCKED, "Ganadero8"));
        });
    }

    @Test
    void shouldExposeConsistentUserMetricsForAdmins() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/dashboard/users")
                .then()
                .statusCode(200)
                .body("admins.total", equalTo(2))
                .body("admins.active", equalTo(1))
                .body("admins.inactive", equalTo(1))
                .body("admins.blocked", equalTo(0))
                .body("ganaderos.total", equalTo(2))
                .body("ganaderos.active", equalTo(1))
                .body("ganaderos.inactive", equalTo(0))
                .body("ganaderos.blocked", equalTo(1));
    }

    @Test
    void shouldDenyDashboardAccessToNonAdmins() {
        String token = loginAs("ganadero-activo", "Ganadero9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/dashboard/users")
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

    private User buildUser(String username, Role role, UserStatus status, String password) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(username + "@hato.bo");
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(status);
        return user;
    }

    private Ganadero buildGanadero(String businessIdentifier, String email) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(UUID.randomUUID());
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(businessIdentifier);
        ganadero.setEmail(email);
        ganadero.setActive(true);
        return ganadero;
    }
}
