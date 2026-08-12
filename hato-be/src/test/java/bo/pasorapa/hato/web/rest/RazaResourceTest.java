package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.RazaRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.RazaService;
import bo.pasorapa.hato.service.dto.raza.CreateRazaRequest;
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
class RazaResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    RazaRepository razaRepository;

    @Inject
    RazaService razaService;

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
            razaRepository.deleteAll();
            userRepository.persist(buildUser("raza-admin", "raza-admin@hato.bo", "RazaAdmin9", Role.ADMIN));
            userRepository.persist(buildUser("raza-ganadero", "raza-ganadero@hato.bo", "RazaGanadero9", Role.GANADERO));
            ganaderoRepository.persist(buildGanadero("raza-ganadero@hato.bo"));
        });
    }

    @Test
    void shouldReturnOnlyActiveBreedsOrderedWithCriollaFirstForGanadero() {
        QuarkusTransaction.requiringNew().run(() -> {
            razaService.create(new CreateRazaRequest("Nelore", null, "Brasil", 2));
            razaService.create(new CreateRazaRequest("Criolla", null, "Bolivia", 1));
            var inactive = razaService.create(new CreateRazaRequest("Holstein", null, "Europa", 5));
            razaService.setActive(inactive.uuid(), false);
        });

        String token = loginAs("raza-ganadero", "RazaGanadero9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/razas/active")
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].nombre", equalTo("Criolla"))
                .body("items.nombre", hasItems("Criolla", "Nelore"));
    }

    @Test
    void shouldAllowAdminCrudAndForbidGanaderoWrites() {
        String adminToken = loginAs("raza-admin", "RazaAdmin9");
        String ganaderoToken = loginAs("raza-ganadero", "RazaGanadero9");

        String uuid = given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .body("""
                        {"nombre":"Brangus","descripcion":"Cruza adaptada","origen":"Bolivia","sortOrder":20}
                        """)
                .when()
                .post("/api/admin/razas")
                .then()
                .statusCode(201)
                .body("nombre", equalTo("Brangus"))
                .body("activo", equalTo(true))
                .extract()
                .path("uuid");

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .body("""
                        {"nombre":"Braford","descripcion":"Sintética","origen":"Argentina","activo":true,"sortOrder":19}
                        """)
                .when()
                .put("/api/admin/razas/{uuid}", uuid)
                .then()
                .statusCode(200)
                .body("nombre", equalTo("Braford"))
                .body("sortOrder", equalTo(19));

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .body("{\"activo\":false}")
                .when()
                .patch("/api/admin/razas/{uuid}/active", uuid)
                .then()
                .statusCode(200)
                .body("activo", equalTo(false));

        given()
                .auth().oauth2(adminToken)
                .when()
                .get("/api/admin/razas")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].uuid", equalTo(uuid))
                .body("items[0].nombre", equalTo("Braford"))
                .body("items[0].activo", equalTo(false));

        given()
                .auth().oauth2(ganaderoToken)
                .contentType(ContentType.JSON)
                .body("""
                        {"nombre":"Senepol","sortOrder":21}
                        """)
                .when()
                .post("/api/admin/razas")
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

    private User buildUser(String username, String email, String password, Role role) {
        User user = new User();
        user.setId(UUID.nameUUIDFromBytes(username.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Ganadero buildGanadero(String email) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(UUID.fromString("f83ac67a-d568-49d1-bf64-d2c978db5ad1"));
        ganadero.setBusinessIdentifier("NIT-RAZA-GANADERO");
        ganadero.setName("Ganadero Raza");
        ganadero.setEmail(email);
        ganadero.setActive(true);
        return ganadero;
    }
}
