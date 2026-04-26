package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.UserRepository;
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
class GanaderosResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            operationLogRepository.deleteAll();
            ganaderoRepository.deleteAll();
            userRepository.deleteAll();
            userRepository.persist(buildUser("root-admin", Role.ADMIN, "RootAdmin9"));
        });
    }

    @Test
    void shouldCreateGanaderoIdempotentlyAndListActiveOnes() {
        String token = loginAs("root-admin", "RootAdmin9");
        String operationId = UUID.randomUUID().toString();

        Response created = given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", operationId)
                .body("""
                        {
                          "businessIdentifier": "NIT-001",
                          "name": "Ganadera del Valle"
                        }
                        """)
                .when()
                .post("/api/admin/ganaderos")
                .then()
                .statusCode(201)
                .body("businessIdentifier", equalTo("NIT-001"))
                .body("active", equalTo(true))
                .extract()
                .response();

        String createdId = created.path("id");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", operationId)
                .body("""
                        {
                          "businessIdentifier": "NIT-001",
                          "name": "Ganadera del Valle"
                        }
                        """)
                .when()
                .post("/api/admin/ganaderos")
                .then()
                .statusCode(200)
                .body("id", equalTo(createdId));

        given()
                .auth().oauth2(token)
                .queryParam("active", true)
                .when()
                .get("/api/admin/ganaderos")
                .then()
                .statusCode(200)
                .body("ganaderos", hasSize(1))
                .body("ganaderos[0].businessIdentifier", equalTo("NIT-001"));

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(1, ganaderoRepository.count());
            assertEquals(1, operationLogRepository.count());
        });
    }

    @Test
    void shouldRejectDuplicateBusinessIdentifier() {
        String token = loginAs("root-admin", "RootAdmin9");

        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganadero = new Ganadero();
            ganadero.setBusinessIdentifier("NIT-001");
            ganadero.setName("Ganadera Base");
            ganaderoRepository.persist(ganadero);
        });

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "businessIdentifier": "NIT-001",
                          "name": "Ganadera Duplicada"
                        }
                        """)
                .when()
                .post("/api/admin/ganaderos")
                .then()
                .statusCode(409)
                .body("code", equalTo("GANADERO_ALREADY_EXISTS"));
    }

    @Test
    void shouldToggleGanaderoStatusAndFilterByActiveFlag() {
        Ganadero ganadero = QuarkusTransaction.requiringNew().call(() -> {
            Ganadero entity = new Ganadero();
            entity.setBusinessIdentifier("NIT-200");
            entity.setName("Ganadera Andina");
            ganaderoRepository.persist(entity);
            ganaderoRepository.flush();
            return entity;
        });

        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "active": false
                        }
                        """)
                .when()
                .put("/api/admin/ganaderos/{id}/status", ganadero.getId())
                .then()
                .statusCode(200)
                .body("active", equalTo(false));

        given()
                .auth().oauth2(token)
                .queryParam("active", true)
                .when()
                .get("/api/admin/ganaderos")
                .then()
                .statusCode(200)
                .body("ganaderos", hasSize(0));

        given()
                .auth().oauth2(token)
                .queryParam("active", false)
                .when()
                .get("/api/admin/ganaderos")
                .then()
                .statusCode(200)
                .body("ganaderos", hasSize(1))
                .body("ganaderos[0].businessIdentifier", equalTo("NIT-200"));
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
}
