package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.repository.GanaderoRepository;
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
class AdminReportsResourceTest {

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
            userRepository.persist(buildUser("reports-admin", Role.ADMIN, "ReportsAdmin9"));
            userRepository.persist(buildUser("reports-ganadero", Role.GANADERO, "ReportsCampo9"));
            ganaderoRepository.persist(buildGanadero("NIT-REPORTS-GANADERO", "reports-ganadero@hato.bo"));
        });
    }

    @Test
    void shouldExposeEmptyAdminReportContractsForAllMvpReports() {
        String token = loginAs("reports-admin", "ReportsAdmin9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/reports/inventory-by-ganadero")
                .then()
                .statusCode(200)
                .body("rows", hasSize(0));

        given()
                .auth().oauth2(token)
                .queryParam("from", "2026-05-01")
                .queryParam("to", "2026-05-10")
                .when()
                .get("/api/admin/reports/health-activity")
                .then()
                .statusCode(200)
                .body("rows", hasSize(0));

        given()
                .auth().oauth2(token)
                .queryParam("from", "2026-05-01")
                .queryParam("to", "2026-05-10")
                .when()
                .get("/api/admin/reports/notification-reach")
                .then()
                .statusCode(200)
                .body("rows", hasSize(0));
    }

    @Test
    void shouldRejectGanaderoAccessToAdminReportsEndpoints() {
        String token = loginAs("reports-ganadero", "ReportsCampo9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/admin/reports/inventory-by-ganadero")
                .then()
                .statusCode(403);
    }

    @Test
    void shouldRejectInvalidReportDateWindowsAndLimits() {
        String token = loginAs("reports-admin", "ReportsAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("from", "2026-05-10")
                .queryParam("to", "2026-05-01")
                .when()
                .get("/api/admin/reports/health-activity")
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_REPORT_DATE_RANGE"));

        given()
                .auth().oauth2(token)
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2026-05-10")
                .when()
                .get("/api/admin/reports/notification-reach")
                .then()
                .statusCode(400)
                .body("code", equalTo("REPORT_DATE_RANGE_TOO_LARGE"));

        given()
                .auth().oauth2(token)
                .queryParam("from", "2026-05-01")
                .queryParam("to", "2026-05-10")
                .queryParam("limit", "501")
                .when()
                .get("/api/admin/reports/health-activity")
                .then()
                .statusCode(400);
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
