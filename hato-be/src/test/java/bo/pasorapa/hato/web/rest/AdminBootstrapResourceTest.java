package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminBootstrapResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
        });
    }

    @Test
    void shouldCreateInitialAdminAndAuditBootstrap() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "root-admin",
                          "email": "root-admin@hato.bo",
                          "displayName": "Root Admin",
                          "password": "RootAdmin9"
                        }
                        """)
                .when()
                .post("/api/admin/bootstrap")
                .then()
                .statusCode(201)
                .body("user.role", equalTo("ADMIN"))
                .body("user.status", equalTo("ACTIVE"));

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(1, userRepository.count());
            assertEquals(1, operationLogRepository.count());
        });
    }

    @Test
    void shouldRejectSecondBootstrapWhenAdminAlreadyExists() {
        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "root-admin",
                          "email": "root-admin@hato.bo",
                          "displayName": "Root Admin",
                          "password": "RootAdmin9"
                        }
                        """)
                .when()
                .post("/api/admin/bootstrap")
                .then()
                .statusCode(201);

        given()
                .contentType("application/json")
                .body("""
                        {
                          "username": "another-admin",
                          "email": "another-admin@hato.bo",
                          "displayName": "Another Admin",
                          "password": "Another99"
                        }
                        """)
                .when()
                .post("/api/admin/bootstrap")
                .then()
                .statusCode(409)
                .body("code", equalTo("BOOTSTRAP_ALREADY_COMPLETED"));
    }
}
