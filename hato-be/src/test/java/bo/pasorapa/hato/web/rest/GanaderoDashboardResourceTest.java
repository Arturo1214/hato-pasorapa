package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.equalTo;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
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
class GanaderoDashboardResourceTest {

    @Inject UserRepository userRepository;
    @Inject AnimalRepository animalRepository;
    @Inject GanaderoRepository ganaderoRepository;
    @Inject PasswordHasher passwordHasher;
    @Inject IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero());
            userRepository.persist(buildUser("ganadero-dashboard", "ganadero-dashboard@hato.bo", Role.GANADERO, "Ganadero9"));
            userRepository.persist(buildUser("root-admin", "root-admin@hato.bo", Role.ADMIN, "RootAdmin9"));
        });
    }

    @Test
    void shouldExposeAnimalsSummaryAndRejectWrongRole() {
        String ganaderoToken = loginAs("ganadero-dashboard", "Ganadero9");
        String adminToken = loginAs("root-admin", "RootAdmin9");

        given().auth().oauth2(ganaderoToken).when().get("/api/ganadero/dashboard/animals-summary").then()
                .statusCode(200)
                .body("$", hasKey("machos"))
                .body("$", hasKey("hembras"));

        given().auth().oauth2(adminToken).when().get("/api/ganadero/dashboard/animals-summary").then()
                .statusCode(403);
    }

    @Test
    void shouldCountAnimalsBySexAndCategoryForAuthenticatedGanadero() {
        String ganaderoToken = loginAs("ganadero-dashboard", "Ganadero9");

        QuarkusTransaction.requiringNew().run(() -> {
            animalRepository.persist(buildAnimal(UUID.fromString("60000000-0000-4000-8000-000000000001"), AnimalCategory.TORO, AnimalSex.MACHO));
            animalRepository.persist(buildAnimal(UUID.fromString("60000000-0000-4000-8000-000000000002"), AnimalCategory.TERNERO, AnimalSex.MACHO));
            animalRepository.persist(buildAnimal(UUID.fromString("60000000-0000-4000-8000-000000000003"), AnimalCategory.VACA, AnimalSex.HEMBRA));
            animalRepository.persist(buildAnimal(UUID.fromString("60000000-0000-4000-8000-000000000004"), AnimalCategory.VAQUILLONA, AnimalSex.HEMBRA));
            animalRepository.persist(buildAnimal(UUID.fromString("60000000-0000-4000-8000-000000000005"), AnimalCategory.TERNERA, AnimalSex.HEMBRA));
            animalRepository.persist(buildAnimal(UUID.fromString("60000000-0000-4000-8000-000000000006"), AnimalCategory.TORO, null));
        });

        given().auth().oauth2(ganaderoToken).when().get("/api/ganadero/dashboard/animals-summary").then()
                .statusCode(200)
                .body("machos.toros", equalTo(1))
                .body("machos.terneros", equalTo(1))
                .body("hembras.vacas", equalTo(1))
                .body("hembras.vaquillas", equalTo(1))
                .body("hembras.terneras", equalTo(1))
                .body("machos.bueyes", equalTo(0))
                .body("hembras.bueyes", equalTo(0));
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

    private Ganadero buildGanadero() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(UUID.fromString("4c6fbe11-492f-41f6-90e9-a8d9a8bb1001"));
        ganadero.setBusinessIdentifier("NIT-DASH-001");
        ganadero.setName("Ganadero Dashboard");
        ganadero.setEmail("ganadero-dashboard@hato.bo");
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal(UUID uuid, AnimalCategory category, AnimalSex sex) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode("CODE-" + uuid);
        animal.setTag("TAG-" + uuid);
        animal.setArete("AR-" + uuid);
        animal.setAreteNormalized(animal.getArete().toLowerCase());
        animal.setMarca("Marca " + uuid.toString().substring(0, 4));
        animal.setMarcaNormalized(animal.getMarca().toLowerCase());
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(UUID.fromString("4c6fbe11-492f-41f6-90e9-a8d9a8bb1001")).orElseThrow());
        animal.setCategory(category);
        animal.setSex(sex);
        animal.setActive(true);
        animal.setAdmissionDate(java.time.LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new java.math.BigDecimal("400.00"));
        animal.setCreatedAt(java.time.LocalDateTime.of(2026, 4, 27, 8, 0));
        animal.setUpdatedAt(java.time.LocalDateTime.of(2026, 4, 27, 8, 0));
        animal.setVersion(0L);
        return animal;
    }

    private User buildUser(String username, String email, Role role, String password) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}
