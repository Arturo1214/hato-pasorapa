package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SyncResourceTest {

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            animalRepository.deleteAll();
            userRepository.deleteAll();
            userRepository.persist(buildUser("root-admin", "root-admin@hato.bo", Role.ADMIN, "RootAdmin9"));
        });
    }

    @Test
    void shouldAcceptCanonicalPushContractForCurrentVersion() {
        UUID animalUuid = UUID.fromString("b9666e6a-d8df-49ac-b82d-52044b72418b");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0003", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "8c2d711a-638f-4c24-bf0f-dc483f8f6d88",
                              "entityType": "ANIMAL",
                              "entityId": "%s",
                              "opType": "UPDATE",
                              "payload": { "tag": "BO-0003" },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(1))
                .body("results[0].operationId", equalTo("8c2d711a-638f-4c24-bf0f-dc483f8f6d88"))
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].serverVersion", equalTo(1));
    }

    @Test
    void shouldReturn409VersionConflictWithManualRefreshHint() {
        UUID animalUuid = UUID.fromString("8bf9bdc0-c230-4398-aaf7-c306ea9717db");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0010", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "0bb34ca6-c72e-47f9-a2f8-2fbb7f91e7d5",
                              "entityType": "ANIMAL",
                              "entityId": "%s",
                              "opType": "UPDATE",
                              "payload": { "tag": "BO-0010" },
                              "baseVersion": 2,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409)
                .body("results", hasSize(1))
                .body("results[0].classification", equalTo("version_conflict"))
                .body("results[0].conflict.clientVersion", equalTo(2))
                .body("results[0].conflict.serverVersion", equalTo(0))
                .body("results[0].conflict.resolutionHint", equalTo("manual_refresh"));
    }

    @Test
    void shouldExposeIncrementalPullEnvelopeEvenWhenNoChangesExist() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL")
                .queryParam("cursorUpdatedAt", "2026-04-26T09:30:00Z")
                .queryParam("cursorId", "animal-cursor-1")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("entityType", equalTo("ANIMAL"))
                .body("items", hasSize(0))
                .body("hasMore", equalTo(false))
                .body("nextCursor.entityType", equalTo("ANIMAL"))
                .body("nextCursor.cursorId", equalTo("animal-cursor-1"));
    }

    @Test
    void shouldReturnAnimalOfflineContractFieldsInIncrementalPull() {
        UUID animalUuid = UUID.fromString("5581b288-8c58-4b31-bc8e-7d7402dabcef");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-7777", 3L, LocalDateTime.of(2026, 4, 26, 12, 0))));

        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL")
                .queryParam("cursorUpdatedAt", "2026-04-26T11:59:00Z")
                .queryParam("cursorId", "11111111-1111-1111-1111-111111111111")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].uuid", equalTo(animalUuid.toString()))
                .body("items[0].version", equalTo(3))
                .body("items[0].updatedAt", notNullValue());
    }

    @Test
    void shouldAcknowledgeDuplicatePushReplayIdempotently() {
        UUID animalUuid = UUID.fromString("ac8d8446-c473-42c5-8510-0fb7903e3b28");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-7000", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        String firstBody = given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(syncUpdateBody("c72b83db-26b9-4da6-a695-1a3251166faa", animalUuid.toString(), "BO-7001", 0))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"))
                .extract()
                .asString();

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(syncUpdateBody("c72b83db-26b9-4da6-a695-1a3251166faa", animalUuid.toString(), "BO-7999", 0))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"))
                .body(equalTo(firstBody));
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

    private Animal buildAnimal(UUID uuid, String tag, Long version, LocalDateTime updatedAt) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode("CODE-" + tag);
        animal.setTag(tag);
        animal.setCategory(AnimalCategory.COW);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("410.00"));
        animal.setVersion(version);
        animal.setCreatedAt(updatedAt.minusDays(1));
        animal.setUpdatedAt(updatedAt);
        return animal;
    }

    private String syncUpdateBody(String operationId, String entityId, String tag, int baseVersion) {
        return """
                {
                  "operations": [
                    {
                      "operationId": "%s",
                      "entityType": "ANIMAL",
                      "entityId": "%s",
                      "opType": "UPDATE",
                      "payload": { "tag": "%s" },
                      "baseVersion": %s,
                      "clientCreatedAt": "2026-04-26T10:00:00Z",
                      "clientUpdatedAt": "2026-04-26T10:01:00Z"
                    }
                  ]
                }
                """.formatted(operationId, entityId, tag, baseVersion);
    }
}
