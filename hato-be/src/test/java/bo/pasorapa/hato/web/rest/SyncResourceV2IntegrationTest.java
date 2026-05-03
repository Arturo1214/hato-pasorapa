package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.HerdLot;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.HerdCostLedgerRepository;
import bo.pasorapa.hato.repository.HerdLotAssignmentRepository;
import bo.pasorapa.hato.repository.HerdLotRepository;
import bo.pasorapa.hato.repository.HerdProductivityLedgerRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.security.PasswordHasher;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
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
class SyncResourceV2IntegrationTest {

    private static final UUID OWNER_ID = UUID.fromString("6c4ab5c9-c9df-4b06-a858-ecbda97453f9");
    private static final UUID ANIMAL_ID = UUID.fromString("aaaaaaaa-1111-4444-8888-000000000001");
    private static final UUID LOT_ID = UUID.fromString("cccccccc-1111-4444-8888-000000000001");

    @Inject
    IntegrationDatabaseCleaner cleaner;

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    HerdLotRepository herdLotRepository;

    @Inject
    HerdLotAssignmentRepository herdLotAssignmentRepository;

    @Inject
    HerdProductivityLedgerRepository herdProductivityLedgerRepository;

    @Inject
    HerdCostLedgerRepository herdCostLedgerRepository;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            cleaner.clean();
            herdCostLedgerRepository.deleteAll();
            herdProductivityLedgerRepository.deleteAll();
            herdLotAssignmentRepository.deleteAll();
            herdLotRepository.deleteAll();
            ganaderoRepository.persist(buildOwner());
            animalRepository.persist(buildAnimal());
            herdLotRepository.persist(buildLot());
            userRepository.persist(buildUser("root-admin", "root-admin@hato.bo", Role.ADMIN, "RootAdmin9"));
        });
    }

    @Test
    void shouldPushAndPullProductivityLedgerThroughSyncResource() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "11111111-1111-4111-8111-111111111111",
                              "entityType": "PRODUCTIVITY_LEDGER",
                              "entityId": "11111111-1111-4111-8111-111111111111",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "lotId": "%s",
                                "periodKey": "2026-04",
                                "metricType": "MILK_LITERS",
                                "value": 120
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-27T10:00:00Z",
                              "clientUpdatedAt": "2026-04-27T10:00:00Z"
                            }
                          ]
                        }
                        """.formatted(ANIMAL_ID, LOT_ID))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "PRODUCTIVITY_LEDGER")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].metricType", equalTo("MILK_LITERS"))
                .body("items[0].value", equalTo(120.0f))
                .body("items[0].forecast", nullValue())
                .body("items[0].score", nullValue())
                .body("items[0].optimization", nullValue())
                .body("items[0].autoAction", nullValue());
    }

    @Test
    void shouldExposeV2PolicyWhenOverlappingLotAssignmentIsRejected() {
        String token = loginAs("root-admin", "RootAdmin9");
        QuarkusTransaction.requiringNew().run(() -> {
            HerdLot secondLot = buildLot();
            secondLot.setLotId(UUID.fromString("cccccccc-1111-4444-8888-000000000002"));
            secondLot.setOperationId(secondLot.getLotId());
            secondLot.setName("Lote B");
            herdLotRepository.persist(secondLot);
        });

        String firstBody = """
                {
                  "operations": [
                    {
                      "operationId": "44444444-4444-4444-8444-444444444444",
                      "entityType": "LOT_ASSIGNMENT",
                      "entityId": "44444444-4444-4444-8444-444444444444",
                      "opType": "CREATE",
                      "payload": { "animalUuid": "%s", "lotId": "%s", "fromDate": "2026-04-01" },
                      "baseVersion": 0,
                      "clientCreatedAt": "2026-04-27T10:00:00Z",
                      "clientUpdatedAt": "2026-04-27T10:00:00Z"
                    }
                  ]
                }
                """.formatted(ANIMAL_ID, LOT_ID);
        String secondBody = """
                {
                  "operations": [
                    {
                      "operationId": "55555555-5555-4555-8555-555555555555",
                      "entityType": "LOT_ASSIGNMENT",
                      "entityId": "55555555-5555-4555-8555-555555555555",
                      "opType": "CREATE",
                      "payload": { "animalUuid": "%s", "lotId": "cccccccc-1111-4444-8888-000000000002", "fromDate": "2026-04-15" },
                      "baseVersion": 0,
                      "clientCreatedAt": "2026-04-27T10:01:00Z",
                      "clientUpdatedAt": "2026-04-27T10:01:00Z"
                    }
                  ]
                }
                """.formatted(ANIMAL_ID);

        given().auth().oauth2(token).header("X-Sync-Conflict-Version", "2").contentType(ContentType.JSON).body(firstBody).when().post("/api/sync/push").then().statusCode(200);

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body(secondBody)
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("validation_error"))
                .body("results[0].conflict.reason", equalTo("LOT_ASSIGNMENT_OVERLAP"))
                .body("results[0].conflict.policy.policyKey", equalTo("offline-conflict-resolution/v2/LOT_ASSIGNMENT/CREATE"));
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

    private Ganadero buildOwner() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(OWNER_ID);
        ganadero.setBusinessIdentifier("NIT-HERD-V2");
        ganadero.setName("Ganadero Herd V2");
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal() {
        Animal animal = new Animal();
        animal.setUuid(ANIMAL_ID);
        animal.setCode("CODE-LOT-1");
        animal.setTag("BO-LOT-1");
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
        animal.setArete("BO-LOT-1");
        animal.setAreteNormalized("bo-lot-1");
        animal.setMarca("BO-LOT-1");
        animal.setMarcaNormalized("bo-lot-1");
        animal.setCategory(AnimalCategory.VACA);
        animal.setSex(AnimalSex.HEMBRA);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("410.00"));
        animal.setVersion(0L);
        animal.setCreatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        animal.setUpdatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        return animal;
    }

    private HerdLot buildLot() {
        HerdLot lot = new HerdLot();
        lot.setLotId(LOT_ID);
        lot.setName("Lote A");
        lot.setDescription(null);
        lot.setActive(true);
        lot.setOperationId(LOT_ID);
        lot.setCreatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        lot.setUpdatedAt(LocalDateTime.of(2026, 4, 1, 0, 0));
        return lot;
    }
}
