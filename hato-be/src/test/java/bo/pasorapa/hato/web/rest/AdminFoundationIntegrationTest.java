package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;

@QuarkusTest
class AdminFoundationIntegrationTest {

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

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
    void shouldExecuteTheFullAdminFoundationFlowWithIdempotentMutations() {
        given()
                .contentType(ContentType.JSON)
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
                .body("user.role", equalTo("ADMIN"));

        String adminToken = loginAs("root-admin", "RootAdmin9");
        String createAdminOperationId = UUID.randomUUID().toString();

        Response createdAdmin = given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", createAdminOperationId)
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
                .body("role", equalTo("ADMIN"))
                .extract()
                .response();

        String managedAdminId = createdAdmin.path("id");

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", createAdminOperationId)
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
                .body("id", equalTo(managedAdminId));

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "username": "campo-user",
                          "email": "campo-user@hato.bo",
                          "displayName": "Campo User",
                          "role": "GANADERO",
                          "password": "CampoUser9"
                        }
                        """)
                .when()
                .post("/api/admin/users")
                .then()
                .statusCode(201)
                .body("role", equalTo("GANADERO"));

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "password": "GestionNueva9"
                        }
                        """)
                .when()
                .put("/api/admin/users/{id}/password", managedAdminId)
                .then()
                .statusCode(200)
                .body("message", equalTo("Contraseña actualizada correctamente."));

        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "gestion-admin",
                          "password": "Gestion99"
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
                          "username": "gestion-admin",
                          "password": "GestionNueva9"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("accessToken", not(blankOrNullString()));

        String createGanaderoOperationId = UUID.randomUUID().toString();

        Response createdGanadero = given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", createGanaderoOperationId)
                .body("""
                        {
                          "businessIdentifier": "NIT-900",
                          "name": "Ganadera Integral"
                        }
                        """)
                .when()
                .post("/api/admin/ganaderos")
                .then()
                .statusCode(201)
                .body("businessIdentifier", equalTo("NIT-900"))
                .extract()
                .response();

        String ganaderoId = createdGanadero.path("id");

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", createGanaderoOperationId)
                .body("""
                        {
                          "businessIdentifier": "NIT-900",
                          "name": "Ganadera Integral"
                        }
                        """)
                .when()
                .post("/api/admin/ganaderos")
                .then()
                .statusCode(200)
                .body("id", equalTo(ganaderoId));

        given()
                .auth().oauth2(adminToken)
                .when()
                .get("/api/admin/dashboard/users")
                .then()
                .statusCode(200)
                .body("admins.total", equalTo(2))
                .body("admins.active", equalTo(2))
                .body("ganaderos.total", equalTo(1))
                .body("ganaderos.active", equalTo(1));
    }

    @Test
    void shouldRejectAdministrativeMutationsWithoutAValidOperationId() {
        given()
                .contentType(ContentType.JSON)
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

        String adminToken = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
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
                .statusCode(400)
                .body("code", equalTo("OPERATION_ID_REQUIRED"));

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", "not-a-uuid")
                .body("""
                        {
                          "businessIdentifier": "NIT-901",
                          "name": "Ganadera sin operación válida"
                        }
                        """)
                .when()
                .post("/api/admin/ganaderos")
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_OPERATION_ID"));
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
}
