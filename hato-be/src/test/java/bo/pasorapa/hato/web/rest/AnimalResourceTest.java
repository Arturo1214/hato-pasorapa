package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.hasKey;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventRepository animalEventRepository;

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
            userRepository.persist(buildUser("animal-admin", "animal-admin@hato.bo", "AdminAnimal9"));
            ganaderoRepository.persist(buildGanadero(UUID.fromString("e469411a-c4cb-4718-b60b-b5c157af5292"), "NIT-ANIMAL-001", "Ganadero Animal"));
        });
    }

    @Test
    void shouldCreateReadAndUpdateAnimalUsingCanonicalUuidContract() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        Response created = given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9100",
                          "marca": "HAT-100",
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
                .body("$", not(hasKey("id")))
                .body("uuid", notNullValue())
                .body("ownerGanaderoId", equalTo("e469411a-c4cb-4718-b60b-b5c157af5292"))
                .body("arete", equalTo("BO-9100"))
                .body("marca", equalTo("HAT-100"))
                .body("version", notNullValue())
                .body("updatedAt", notNullValue())
                .extract()
                .response();

        String uuid = created.path("uuid");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}", uuid)
                .then()
                .statusCode(200)
                .body("$", not(hasKey("id")))
                .body("uuid", equalTo(uuid))
                .body("ownerGanaderoId", equalTo("e469411a-c4cb-4718-b60b-b5c157af5292"))
                .body("arete", equalTo("BO-9100"));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9101",
                          "marca": "HAT-101",
                          "category": "COW",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 420.25
                        }
                        """)
                .when()
                .put("/api/animals/{uuid}", uuid)
                .then()
                .statusCode(200)
                .body("$", not(hasKey("id")))
                .body("uuid", equalTo(uuid))
                .body("arete", equalTo("BO-9101"))
                .body("marca", equalTo("HAT-101"))
                .body("weightKg", equalTo(420.25F));
    }

    @Test
    void shouldRequireOwnerGanaderoIdWhenAnimalIsCreated() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "arete": "BO-9100",
                          "category": "COW",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400);
    }

    @Test
    void shouldFilterAnimalsByVisibleOwnerActiveAndCategory() {
        String token = loginAs("animal-admin", "AdminAnimal9");
        UUID ownerA = UUID.fromString("e469411a-c4cb-4718-b60b-b5c157af5292");
        UUID ownerB = UUID.fromString("20c7b2ef-f6ff-454b-976b-cbbfa293e3cf");

        QuarkusTransaction.requiringNew().run(() -> {
            ganaderoRepository.persist(buildGanadero(ownerB, "NIT-ANIMAL-002", "Ganadero Sur"));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("d9a81b4e-faed-4a59-a55d-5fd65f6a3c11"),
                    "legacy-a",
                    "tag-a",
                    ownerA,
                    "ARETE-OPERATIVO-01",
                    null,
                    null,
                    AnimalCategory.COW,
                    true,
                    LocalDate.of(2024, 2, 1),
                    new BigDecimal("410.50"),
                    LocalDateTime.of(2026, 4, 27, 8, 0, 0),
                    3L));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("d3138ff0-4b7c-4df8-af60-b5968faf5abf"),
                    "legacy-b",
                    "tag-b",
                    ownerA,
                    null,
                    "Marca Secundaria",
                    null,
                    AnimalCategory.HEIFER,
                    true,
                    LocalDate.of(2024, 3, 1),
                    new BigDecimal("350.00"),
                    LocalDateTime.of(2026, 4, 27, 9, 0, 0),
                    2L));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("7d9c636d-0919-49bf-aeb1-97fd8645d4f8"),
                    "legacy-c",
                    "tag-c",
                    ownerB,
                    "ARETE-OPERATIVO-99",
                    null,
                    null,
                    AnimalCategory.COW,
                    false,
                    LocalDate.of(2024, 4, 1),
                    new BigDecimal("500.00"),
                    LocalDateTime.of(2026, 4, 27, 10, 0, 0),
                    5L));
        });

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals?visible.contains=operativo&ownerGanaderoId.equals={owner}&active.equals=true&category.equals=COW&page=0&size=20&sort=updatedAt,desc", ownerA)
                .then()
                .statusCode(200)
                .body("content", hasSize(1))
                .body("content[0].uuid", equalTo("d9a81b4e-faed-4a59-a55d-5fd65f6a3c11"))
                .body("content[0].ownerGanaderoId", equalTo(ownerA.toString()))
                .body("content[0].arete", equalTo("ARETE-OPERATIVO-01"))
                .body("content[0].category", equalTo("COW"))
                .body("content[0].active", equalTo(true));
    }

    @Test
    void shouldRejectInvalidBooleanFilterForActive() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals?active.equals=si")
                .then()
                .statusCode(400)
                .body("code", equalTo("ANIMAL_INVALID_FILTER"));
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

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(name);
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal(
            UUID uuid,
            String code,
            String tag,
            UUID ownerGanaderoId,
            String arete,
            String marca,
            String tatuaje,
            AnimalCategory category,
            boolean active,
            LocalDate admissionDate,
            BigDecimal weightKg,
            LocalDateTime updatedAt,
            long version
    ) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode(code);
        animal.setTag(tag);
        animal.setOwnerGanadero(ganaderoRepository.findById(ownerGanaderoId));
        animal.setArete(arete);
        animal.setMarca(marca);
        animal.setTatuaje(tatuaje);
        animal.setAreteNormalized(normalizeVisible(arete));
        animal.setMarcaNormalized(normalizeVisible(marca));
        animal.setTatuajeNormalized(normalizeVisible(tatuaje));
        animal.setCategory(category);
        animal.setActive(active);
        animal.setAdmissionDate(admissionDate);
        animal.setWeightKg(weightKg);
        animal.setCreatedAt(updatedAt.minusHours(1));
        animal.setUpdatedAt(updatedAt);
        animal.setVersion(version);
        animal.setLastSyncedAt(updatedAt);
        return animal;
    }

    private String normalizeVisible(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }
}
