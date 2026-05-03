package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
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
class AdminProfileResourceTest {

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

            User admin = buildUser("root-admin", "root-admin@hato.bo", Role.ADMIN, UserStatus.ACTIVE, "RootAdmin9");
            User ganaderoUser = buildUser("campo@hato.bo", "campo@hato.bo", Role.GANADERO, UserStatus.ACTIVE, "CampoUser9");
            userRepository.persist(admin);
            userRepository.persist(ganaderoUser);

            Ganadero ganadero = new Ganadero();
            ganadero.setBusinessIdentifier("CI-900");
            ganadero.setName("Campo Base");
            ganadero.setEmail("campo@hato.bo");
            ganaderoRepository.persist(ganadero);
        });
    }

    @Test
    void shouldUpdateOwnGanaderoContactData() {
        String token = loginAs("campo@hato.bo", "CampoUser9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "telefono": "70000001",
                          "direccion": "Calle Comercio #15"
                        }
                        """)
                .when()
                .put("/api/admin/profile")
                .then()
                .statusCode(200)
                .body("telefono", equalTo("70000001"))
                .body("direccion", equalTo("Calle Comercio #15"))
                .body("role", equalTo("GANADERO"));
    }

    @Test
    void shouldRejectPasswordChangeWhenCurrentPasswordIsIncorrect() {
        String token = loginAs("campo@hato.bo", "CampoUser9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "currentPassword": "Incorrecta9",
                          "newPassword": "NuevaClave9"
                        }
                        """)
                .when()
                .put("/api/admin/profile/password")
                .then()
                .statusCode(400)
                .body("code", equalTo("CURRENT_PASSWORD_INVALID"))
                .body("message", equalTo("Contraseña actual incorrecta"));
    }

    @Test
    void shouldChangeOwnPasswordAndInvalidateThePreviousOne() {
        String token = loginAs("campo@hato.bo", "CampoUser9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "currentPassword": "CampoUser9",
                          "newPassword": "NuevaClave9"
                        }
                        """)
                .when()
                .put("/api/admin/profile/password")
                .then()
                .statusCode(200)
                .body("message", equalTo("Contraseña actualizada correctamente."));

        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "campo@hato.bo",
                          "password": "CampoUser9"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("code", equalTo("INVALID_CREDENTIALS"));

        String refreshedToken = given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "campo@hato.bo",
                          "password": "NuevaClave9"
                        }
                        """)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .extract()
                .path("accessToken");

        assertTrue(refreshedToken != null && !refreshedToken.isBlank());
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
