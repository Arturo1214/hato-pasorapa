package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.AnimalImageService;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
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
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalImageResourceTest {

    private static final UUID OWNER_ID = UUID.fromString("ae2cb895-826c-4983-b769-df6948df379e");
    private static final UUID USER_ID = UUID.fromString("8a20f320-0247-4df1-9b1f-4920d7b4bd14");

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    AnimalImageService animalImageService;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("animal-image-admin", "animal-image-admin@hato.bo", "AnimalImage9"));
            ganaderoRepository.persist(buildGanadero());
        });
    }

    @Test
    void shouldListAnimalImagesInStableOrderAndDownloadAuthenticatedContent() {
        UUID animalUuid = UUID.fromString("850009bb-f226-42e2-aaf3-c52edcfd16fc");
        seedAnimal(animalUuid);
        var first = createImage(animalUuid, UUID.fromString("00000000-0000-0000-0000-000000000100"), "2026-04-26T09:00:00Z", "uno");
        var second = createImage(animalUuid, UUID.fromString("00000000-0000-0000-0000-000000000200"), "2026-04-26T10:00:00Z", "dos");
        String token = loginAs("animal-image-admin", "AnimalImage9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}/images", animalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].operationId", equalTo(first.getOperationId().toString()))
                .body("items[1].operationId", equalTo(second.getOperationId().toString()))
                .body("items[0].thumbnailRef", notNullValue());

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animal-images/{id}/content", second.getImageId())
                .then()
                .statusCode(200)
                .contentType("image/jpeg")
                .header("Content-Disposition", org.hamcrest.Matchers.containsString(second.getFileName()));
    }

    private bo.pasorapa.hato.domain.AnimalImage createImage(UUID animalUuid, UUID operationId, String capturedAt, String payload) {
        byte[] content = payload.getBytes();
        return QuarkusTransaction.requiringNew().call(() -> animalImageService.create(new AnimalImageRequest(
                animalUuid,
                operationId,
                "image/jpeg",
                operationId + ".jpg",
                content.length,
                AnimalImageSecuritySupport.sha256Hex(content),
                Base64.getEncoder().encodeToString(content),
                OffsetDateTime.parse(capturedAt),
                "OFFLINE")));
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
        user.setId(USER_ID);
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Ganadero buildGanadero() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(OWNER_ID);
        ganadero.setBusinessIdentifier("NIT-IMAGE-OWNER");
        ganadero.setName("Ganadero Image");
        ganadero.setActive(true);
        return ganadero;
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
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
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
