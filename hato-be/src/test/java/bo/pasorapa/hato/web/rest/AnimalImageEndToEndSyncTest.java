package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import bo.pasorapa.hato.service.security.PasswordHasher;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalImageEndToEndSyncTest {

    private static final UUID OWNER_ID = UUID.fromString("5e2cb895-826c-4983-b769-df6948df379e");

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

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
            Ganadero owner = new Ganadero();
            owner.setId(OWNER_ID);
            owner.setBusinessIdentifier("NIT-IMAGE-E2E");
            owner.setName("Ganadero Image E2E");
            owner.setActive(true);
            ganaderoRepository.persist(owner);
            userRepository.persist(buildUser("animal-image-e2e", "animal-image-e2e@hato.bo", "AnimalImage9"));
        });
    }

    @Test
    void shouldSyncOfflineImageThenListAndDownloadAuthenticatedContent() {
        UUID animalUuid = UUID.fromString("750009bb-f226-42e2-aaf3-c52edcfd16fc");
        seedAnimal(animalUuid);
        String token = loginAs("animal-image-e2e", "AnimalImage9");
        UUID operationId = UUID.fromString("6f51850f-5fc4-4cbe-b23f-6fe8837fd4c8");
        byte[] content = "offline-image".getBytes();

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "%s",
                              "entityType": "ANIMAL_IMAGE",
                              "entityId": "%s",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "operationId": "%s",
                                "mimeType": "image/jpeg",
                                "fileName": "offline.jpg",
                                "sizeBytes": %s,
                                "checksumSha256": "%s",
                                "base64Data": "%s",
                                "capturedAt": "2026-04-26T10:03:00Z",
                                "sourceChannel": "OFFLINE"
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(
                        operationId,
                        operationId,
                        animalUuid,
                        operationId,
                        content.length,
                        AnimalImageSecuritySupport.sha256Hex(content),
                        Base64.getEncoder().encodeToString(content)))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"));

        String imageId = given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}/images", animalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].operationId", equalTo(operationId.toString()))
                .extract()
                .path("items[0].id");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animal-images/{id}/content", imageId)
                .then()
                .statusCode(200)
                .contentType("image/jpeg");
    }

    private String loginAs(String username, String password) {
        return given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          \"username\": \"%s\",
                          \"password\": \"%s\"
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

    private void seedAnimal(UUID animalUuid) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + animalUuid);
            animal.setTag("TAG-" + animalUuid);
            animal.setArete("AR-" + animalUuid.toString().substring(0, 8));
            animal.setAreteNormalized(animal.getArete().toLowerCase());
            animal.setMarca("Marca Norte");
            animal.setMarcaNormalized("marca norte");
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
            animal.setCategory(AnimalCategory.COW);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("410.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 26, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 26, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }
}
