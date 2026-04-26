package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            userRepository.deleteAll();
            userRepository.persist(buildUser("animal-admin", "animal-admin@hato.bo", "AdminAnimal9"));
        });
    }

    @Test
    void shouldExposeOfflineContractFieldsWhenAnimalIsCreated() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "code": "HAT-100",
                          "tag": "BO-9100",
                          "category": "COW",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(201)
                .body("uuid", notNullValue())
                .body("version", notNullValue())
                .body("updatedAt", notNullValue());
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

    private User buildUser(String username, String email, String password) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
