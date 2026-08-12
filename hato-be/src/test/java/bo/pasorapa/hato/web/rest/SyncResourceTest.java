package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalImage;
import bo.pasorapa.hato.service.model.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalImageRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.SyncOperationReceiptRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import bo.pasorapa.hato.support.sync.SyncHarnessFixtures;

@QuarkusTest
class SyncResourceTest {

    // CI V1 gate: [smoke] corre siempre en pipeline por defecto; [stress] queda manual/on-demand.

    private static final UUID DEFAULT_OWNER_GANADERO_ID = UUID.fromString("6c4ab5c9-c9df-4b06-a858-ecbda97453f9");

    private SyncHarnessFixtures fixtures;

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventLogRepository animalEventLogRepository;

    @Inject
    AnimalImageRepository animalImageRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    OperationLogRepository operationLogRepository;

    @Inject
    SyncOperationReceiptRepository syncOperationReceiptRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        fixtures = new SyncHarnessFixtures(animalRepository, ganaderoRepository, userRepository);
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            Ganadero owner = new Ganadero();
            owner.setId(DEFAULT_OWNER_GANADERO_ID);
            owner.setBusinessIdentifier("NIT-ANIMAL-SYNC");
            owner.setName("Ganadero Sync");
            owner.setActive(true);
            ganaderoRepository.persist(owner);
            ganaderoRepository.flush();
            ganaderoRepository.getEntityManager()
                    .createNativeQuery("update ganaderos set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, 0L)
                    .setParameter(2, LocalDateTime.of(2020, 1, 1, 0, 0))
                    .setParameter(3, LocalDateTime.of(2020, 1, 1, 0, 0))
                    .setParameter(4, DEFAULT_OWNER_GANADERO_ID)
                    .executeUpdate();
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
    void shouldSyncAnimalEventCreateAndPreserveOfflineAuditFromAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("b9666e6a-d8df-49ac-b82d-52044b72418c");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0020", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "6f51850f-5fc4-4cbe-b23f-6fe8837fd4c8",
                              "entityType": "ANIMAL_EVENT",
                              "entityId": "6f51850f-5fc4-4cbe-b23f-6fe8837fd4c8",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "type": "LOST",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Animal no localizado",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "operationId": "6f51850f-5fc4-4cbe-b23f-6fe8837fd4c8",
                                "metadata": { "reasonCode": "NOT_FOUND" }
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, currentUserIdFor("root-admin")))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(1))
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityType", equalTo("ANIMAL_EVENT"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL_EVENT")
                .queryParam("cursorUpdatedAt", "2026-04-26T10:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(animalUuid.toString()))
                .body("items[0].sourceChannel", equalTo("OFFLINE"))
                .body("items[0].performedByUserId", equalTo(currentUserIdFor("root-admin")));
    }

    @Test
    void shouldAcceptUnifiedAnimalEventLogPushContract() {
        UUID animalUuid = UUID.fromString("b9666e6a-d8df-49ac-b82d-52044b7241a1");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-LOG", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "6f51850f-5fc4-4cbe-b23f-6fe8837fd4d1",
                              "entityType": "ANIMAL_EVENT_LOG",
                              "entityId": "6f51850f-5fc4-4cbe-b23f-6fe8837fd4d1",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "eventCategory": "GENERAL",
                                "eventType": "OBSERVATION",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Control visual sin novedades",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "operationId": "6f51850f-5fc4-4cbe-b23f-6fe8837fd4d1",
                                "metadata": { "source": "smoke" }
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, currentUserIdFor("root-admin")))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(1))
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityType", equalTo("ANIMAL_EVENT_LOG"))
                .body("results[0].operationId", equalTo("6f51850f-5fc4-4cbe-b23f-6fe8837fd4d1"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL_EVENT_LOG")
                .queryParam("cursorUpdatedAt", "2026-04-26T10:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(animalUuid.toString()))
                .body("items[0].eventCategory", equalTo("GENERAL"))
                .body("items[0].eventType", equalTo("OBSERVATION"));
    }

    @Test
    void shouldRejectAnimalEventTypesOutsideV1CatalogThroughSyncResource() {
        UUID animalUuid = UUID.fromString("b9666e6a-d8df-49ac-b82d-52044b72418d");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0021", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "4ad41729-8d0f-4dc6-bb55-b9a7105c8ef2",
                              "entityType": "ANIMAL_EVENT",
                              "entityId": "4ad41729-8d0f-4dc6-bb55-b9a7105c8ef2",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "type": "SANITARY",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Fuera de alcance",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "operationId": "4ad41729-8d0f-4dc6-bb55-b9a7105c8ef2",
                                "metadata": {}
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, currentUserIdFor("root-admin")))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("validation_error"))
                .body("results[0].conflict.reason", equalTo("ANIMAL_EVENT_TYPE_INVALID"));
    }

    @Test
    void shouldSyncAnimalHealthEventCreateAndPullIncrementally() {
        UUID animalUuid = UUID.fromString("6f6a34a1-f8f4-492d-b9c9-b5b5a79635f4");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0022", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "9f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "entityType": "ANIMAL_HEALTH_EVENT",
                              "entityId": "9f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "healthEventType": "VACCINATION",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Vacuna anual",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "operationId": "9f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                                "metadata": { "productName": "Brucelosis" }
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, currentUserIdFor("root-admin")))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(1))
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityType", equalTo("ANIMAL_HEALTH_EVENT"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL_HEALTH_EVENT")
                .queryParam("cursorUpdatedAt", "2026-04-26T10:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(animalUuid.toString()))
                .body("items[0].healthEventType", equalTo("VACCINATION"));
    }

    @Test
    void shouldSyncFieldVetVisitOnlyOncePerOperationIdAndPullTypedMetadata() {
        UUID animalUuid = UUID.fromString("7f6a34a1-f8f4-492d-b9c9-b5b5a79635f4");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0022-VET", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");
        String body = """
                {
                  "operations": [
                    {
                      "operationId": "1f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                      "entityType": "ANIMAL_HEALTH_EVENT",
                      "entityId": "1f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                      "opType": "CREATE",
                      "payload": {
                        "animalUuid": "%s",
                        "healthEventType": "FIELD_VET_VISIT",
                        "occurredAt": "2026-04-26T10:03:00Z",
                        "notes": "Control veterinario de campo",
                        "performedByUserId": "%s",
                        "sourceChannel": "OFFLINE",
                        "operationId": "1f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                        "metadata": {
                          "visit": {
                            "visitId": "VISIT-100",
                            "mode": "SPECIFIC",
                            "status": "PENDING",
                            "veterinarian": { "name": "Dra. Campo", "license": "VET-100" }
                          },
                          "checklist": [
                            { "code": "TEMPERATURE", "ok": true },
                            { "code": "APPETITE", "ok": false, "note": "Disminuido" }
                          ],
                          "clinicalNote": {
                            "reason": "Control",
                            "findings": "Leve fiebre",
                            "plan": "Seguimiento en 48h"
                          },
                            "protocol": {
                              "status": "STARTED"
                            }
                        }
                      },
                      "baseVersion": 0,
                      "clientCreatedAt": "2026-04-26T10:03:00Z",
                      "clientUpdatedAt": "2026-04-26T10:03:00Z"
                    }
                  ]
                }
                """.formatted(animalUuid, currentUserIdFor("root-admin"));

        given().auth().oauth2(token).contentType(ContentType.JSON).body(body).when().post("/api/sync/push").then().statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"));

        given().auth().oauth2(token).contentType(ContentType.JSON).body(body).when().post("/api/sync/push").then().statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL_HEALTH_EVENT")
                .queryParam("cursorUpdatedAt", "2026-04-26T10:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].healthEventType", equalTo("FIELD_VET_VISIT"))
                .body("items[0].metadata.visit.visitId", equalTo("VISIT-100"))
                .body("items[0].metadata.protocol.status", equalTo("STARTED"));

        org.junit.jupiter.api.Assertions.assertEquals(1, animalEventLogRepository.count());
    }

    @Test
    void shouldRejectAnimalHealthEventMissingPayloadOperationIdThroughSyncResource() {
        UUID animalUuid = UUID.fromString("dba304eb-530a-4470-ad2d-c0a84639fe4c");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0023", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "9c0b546f-b163-43ce-afd8-e52f95b7be07",
                              "entityType": "ANIMAL_HEALTH_EVENT",
                              "entityId": "pending-health-1",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "healthEventType": "VACCINATION",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Vacuna anual",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "metadata": { "productName": "Brucelosis" }
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, currentUserIdFor("root-admin")))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("validation_error"))
                .body("results[0].conflict.reason", equalTo("ANIMAL_HEALTH_EVENT_OPERATION_ID_REQUIRED"));
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
    void shouldListAndResolvePendingConflictsThroughV2Endpoints() {
        UUID animalUuid = UUID.fromString("01f2c8a0-9d46-4400-8fe3-0ea47ef65c30");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0090", 3L, LocalDateTime.of(2026, 4, 28, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body(syncUpdateBody("419dd08c-a597-40f5-9264-20fb5aa30f77", animalUuid.toString(), "BO-0091", 1))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409)
                .body("results[0].conflict.allowedActions", hasSize(3))
                .body("results[0].conflict.policyKey", equalTo("offline-conflict-resolution/v2/ANIMAL/UPDATE"));

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .when()
                .get("/api/sync/conflicts")
                .then()
                .statusCode(200)
                .body("size()", greaterThanOrEqualTo(1))
                .body("[0].operationId", equalTo("419dd08c-a597-40f5-9264-20fb5aa30f77"))
                .body("[0].auditTrail", hasSize(1));

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "action": "accept_server",
                          "reason": "Priorizamos el snapshot remoto como fuente final."
                        }
                        """)
                .when()
                .post("/api/sync/conflicts/419dd08c-a597-40f5-9264-20fb5aa30f77/resolve")
                .then()
                .statusCode(200)
                .body("status", equalTo("resolved"))
                .body("nextLocalStatus", equalTo("acked"));
    }

    @Test
    @DisplayName("[stress] should append repeated conflict audit entries through REST after retry_local replay")
    void shouldAppendRepeatedConflictAuditEntriesThroughRestAfterRetryLocalReplay() {
        UUID animalUuid = UUID.fromString("77777777-7777-4777-8777-777777777777");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-REST-CONFLICT", 4L, LocalDateTime.of(2026, 4, 28, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");
        String operationId = "88888888-8888-4888-8888-888888888888";

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body(syncUpdateBody(operationId, animalUuid.toString(), "BO-REST-CONFLICT-2", 2))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409)
                .body("results[0].conflict.allowedActions", hasSize(3));

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "action": "retry_local",
                          "reason": "Reintentamos el payload original sin editarlo."
                        }
                        """)
                .when()
                .post("/api/sync/conflicts/%s/resolve".formatted(operationId))
                .then()
                .statusCode(200)
                .body("status", equalTo("resolved"))
                .body("nextLocalStatus", equalTo("pending"));

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body(syncUpdateBody(operationId, animalUuid.toString(), "BO-REST-CONFLICT-2", 2))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409)
                .body("results[0].conflict.policyKey", equalTo("offline-conflict-resolution/v2/ANIMAL/UPDATE"));

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .when()
                .get("/api/sync/conflicts")
                .then()
                .statusCode(200)
                .body("size()", greaterThanOrEqualTo(1))
                .body("[0].operationId", equalTo(operationId))
                .body("[0].auditTrail", hasSize(3))
                .body("[0].auditTrail[0].eventType", equalTo("DETECTED"))
                .body("[0].auditTrail[1].eventType", equalTo("RESOLVED"))
                .body("[0].auditTrail[1].resultStatus", equalTo("pending"))
                .body("[0].auditTrail[2].eventType", equalTo("DETECTED"));
    }

    @Test
    void shouldRejectConflictResolutionWithoutReasonOrRequiredV2Header() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/sync/conflicts")
                .then()
                .statusCode(412)
                .body("code", equalTo("SYNC_CONFLICT_V2_HEADER_REQUIRED"));

        given()
                .auth().oauth2(token)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "action": "discard_local",
                          "reason": ""
                        }
                        """)
                .when()
                .post("/api/sync/conflicts/419dd08c-a597-40f5-9264-20fb5aa30f77/resolve")
                .then()
                .statusCode(400);
    }

    @Test
    void shouldAllowOnlyTheConflictOwnerToResolveThroughRest() {
        UUID animalUuid = UUID.fromString("98989898-9898-4989-8989-989898989898");
        String operationId = "97979797-9797-4979-8979-979797979797";

        UUID ownerGanaderoId = UUID.fromString("4bf99828-9a6d-491d-9aa6-69100a8e718a");
        QuarkusTransaction.requiringNew().run(() -> {
            userRepository.persist(buildUser("ganadero-conflict", "ganadero-conflict@hato.bo", Role.GANADERO, "Ganadero9"));
            ganaderoRepository.persist(buildGanadero(
                    ownerGanaderoId,
                    "NIT-GANADERO-CONFLICT",
                    "Ganadero Conflict",
                    "ganadero-conflict@hato.bo",
                    true,
                    LocalDateTime.of(2026, 4, 28, 10, 0)));
            animalRepository.persist(buildAnimal(animalUuid, "BO-GAN-1", ownerGanaderoId, 4L, LocalDateTime.of(2026, 4, 28, 10, 0)));
        });

        String ganaderoToken = loginAs("ganadero-conflict", "Ganadero9");
        String adminToken = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(ganaderoToken)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body(syncUpdateBody(operationId, animalUuid.toString(), "BO-GAN-2", 2))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409);

        given()
                .auth().oauth2(adminToken)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "action": "retry_local",
                          "reason": "Intento indebido del admin."
                        }
                        """)
                .when()
                .post("/api/sync/conflicts/%s/resolve".formatted(operationId))
                .then()
                .statusCode(403)
                .body("code", equalTo("SYNC_CONFLICT_FORBIDDEN"));

        given()
                .auth().oauth2(ganaderoToken)
                .header("X-Sync-Conflict-Version", "2")
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "action": "retry_local",
                          "reason": "Resuelve el mismo ganadero dueño del conflicto."
                        }
                        """)
                .when()
                .post("/api/sync/conflicts/%s/resolve".formatted(operationId))
                .then()
                .statusCode(200)
                .body("status", equalTo("resolved"))
                .body("nextLocalStatus", equalTo("pending"));
    }

    @Test
    void shouldExposeObservabilityUsingDefault24hWindow() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/sync/observability")
                .then()
                .statusCode(200)
                .body("window", equalTo("24h"))
                .body("dictionary", hasSize(5));
    }

    @Test
    void shouldAcceptObservability7dWindow() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("window", "7d")
                .when()
                .get("/api/sync/observability")
                .then()
                .statusCode(200)
                .body("window", equalTo("7d"));
    }

    @Test
    void shouldRejectObservabilityWindowOutsideV2Contract() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("window", "30d")
                .when()
                .get("/api/sync/observability")
                .then()
                .statusCode(400)
                .body("code", equalTo("SYNC_OBSERVABILITY_WINDOW_INVALID"));
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
    @DisplayName("[smoke] should expose hasMore=true over REST and drain the next page deterministically")
    void shouldExposePagedPullEnvelopeOverRest() {
        fixtures.seedAnimalPage("REST-PAGE-", 101, LocalDateTime.of(2026, 4, 28, 8, 0));
        String token = loginAs("root-admin", "RootAdmin9");

        String nextCursorId = given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL")
                .queryParam("cursorUpdatedAt", "2026-04-28T07:59:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(100))
                .body("hasMore", equalTo(true))
                .extract()
                .path("nextCursor.cursorId");

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL")
                .queryParam("cursorUpdatedAt", "2026-04-28T09:39:00Z")
                .queryParam("cursorId", nextCursorId)
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("hasMore", equalTo(false));
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
                .body("items[0]", not(hasKey("id")))
                .body("items[0]", not(hasKey("code")))
                .body("items[0]", not(hasKey("tag")))
                .body("items[0].uuid", equalTo(animalUuid.toString()))
                .body("items[0].ownerGanaderoId", equalTo(DEFAULT_OWNER_GANADERO_ID.toString()))
                .body("items[0].arete", equalTo("BO-7777"))
                .body("items[0].version", equalTo(3))
                .body("items[0].updatedAt", notNullValue());
    }

    @Test
    void shouldCreateAnimalOfflineUsingCanonicalUuidContract() {
        String token = loginAs("root-admin", "RootAdmin9");
        String animalUuid = "434b8839-51a3-4dbd-9357-01d197900c5c";

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "5b63b418-6cb9-4511-8bf7-21f0fd467be1",
                              "entityType": "ANIMAL",
                              "entityId": "%s",
                              "opType": "CREATE",
                              "payload": {
                                "ownerGanaderoId": "%s",
                                "arete": " AR-8800 ",
                                "marca": "Marca Centro",
                                "category": "HEIFER",
                                "sex": "HEMBRA",
                                "active": true,
                                "admissionDate": "2026-04-24",
                                "weightKg": 395.5
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, DEFAULT_OWNER_GANADERO_ID))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityId", equalTo(animalUuid))
                .body("results[0].serverVersion", equalTo(0));
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

    @Test
    void shouldRejectOfflineOperationsOutsideCapabilityMatrixWithExplicitReason() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "f6f0481b-0e37-4d44-843d-06dc36fb7ee7",
                              "entityType": "USER",
                              "entityId": "b6f6d75b-2f0d-4f7d-b503-c10f7022f1c5",
                              "opType": "CREATE",
                              "payload": { "username": "offline-admin" },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T13:00:00Z",
                              "clientUpdatedAt": "2026-04-26T13:00:00Z"
                            }
                          ]
                        }
                        """)
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(1))
                .body("results[0].classification", equalTo("validation_error"))
                .body("results[0].conflict.reason", equalTo("OPERATION_NOT_ALLOWED_OFFLINE"))
                .body("results[0].conflict.resolutionHint", equalTo("manual_refresh"));
    }

    @Test
    void shouldSyncUserStatusUpdateThroughCanonicalPushContract() {
        UUID userId = UUID.fromString("dc86a2ca-76ad-44f2-81be-30e5ece1ec22");
        QuarkusTransaction.requiringNew().run(() -> userRepository.persist(buildManagedUser(userId, "offline-user", "offline-user@hato.bo", UserStatus.ACTIVE)));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "6b30c863-39cc-4f85-bc4d-3d05892f8a98",
                              "entityType": "USER",
                              "entityId": "%s",
                              "opType": "STATUS_UPDATE",
                              "payload": { "status": "INACTIVE" },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """.formatted(userId))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityId", equalTo(userId.toString()))
                .body("results[0].serverVersion", equalTo(1));
    }

    @Test
    void shouldReturn409ForUserVersionConflict() {
        UUID userId = UUID.fromString("aa034d7d-fe0a-4490-82b9-b00f812eab06");
        QuarkusTransaction.requiringNew().run(() -> {
            User user = buildManagedUser(userId, "conflict-user", "conflict-user@hato.bo", UserStatus.ACTIVE);
            userRepository.persist(user);
            userRepository.flush();
            userRepository.getEntityManager()
                    .createNativeQuery("update users set version = ?1 where id = ?2")
                    .setParameter(1, 3L)
                    .setParameter(2, userId)
                    .executeUpdate();
        });
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "8378c0f3-269e-44a2-b9da-8af97f13ef25",
                              "entityType": "USER",
                              "entityId": "%s",
                              "opType": "STATUS_UPDATE",
                              "payload": { "status": "INACTIVE" },
                              "baseVersion": 1,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """.formatted(userId))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409)
                .body("results[0].classification", equalTo("version_conflict"))
                .body("results[0].conflict.serverVersion", equalTo(3))
                .body("results[0].conflict.resolutionHint", equalTo("manual_refresh"));
    }

    @Test
    void shouldCreateGanaderoOfflineUsingOperationIdAsCanonicalIdentity() {
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "67fd3e6b-03cd-4d59-aec9-0853d473adff",
                              "entityType": "GANADERO",
                              "entityId": "pending:ganadero-1",
                              "opType": "CREATE",
                              "payload": {
                                "businessIdentifier": "NIT-700",
                                "name": "Ganadera Offline"
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """)
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityId", equalTo("67fd3e6b-03cd-4d59-aec9-0853d473adff"))
                .body("results[0].serverVersion", equalTo(0));
    }

    @Test
    void shouldReturnGanaderoIncrementalPullEnvelopeAndConflictContract() {
        UUID ganaderoId = UUID.fromString("9a252406-8e9a-4a67-a580-f2f4c024aa99");
        QuarkusTransaction.requiringNew().run(() -> {
            ganaderoRepository.persist(buildGanadero(ganaderoId, "NIT-801", "Ganadera Pull", true, LocalDateTime.of(2026, 4, 26, 12, 0)));
            ganaderoRepository.flush();
            ganaderoRepository.getEntityManager()
                    .createNativeQuery("update ganaderos set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, 2L)
                    .setParameter(2, LocalDateTime.of(2026, 4, 25, 12, 0))
                    .setParameter(3, LocalDateTime.of(2026, 4, 26, 12, 0))
                    .setParameter(4, ganaderoId)
                    .executeUpdate();
        });
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "GANADERO")
                .queryParam("cursorUpdatedAt", "2026-04-26T11:59:00Z")
                .queryParam("cursorId", "11111111-1111-1111-1111-111111111111")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].id", equalTo(ganaderoId.toString()))
                .body("items[0].businessIdentifier", equalTo("NIT-801"))
                .body("nextCursor.cursorId", equalTo(ganaderoId.toString()));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "05e1e63d-703c-4e6c-af4f-10cfef3b0a58",
                              "entityType": "GANADERO",
                              "entityId": "%s",
                              "opType": "STATUS_UPDATE",
                              "payload": { "active": false },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:00:00Z",
                              "clientUpdatedAt": "2026-04-26T10:01:00Z"
                            }
                          ]
                        }
                        """.formatted(ganaderoId))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(409)
                .body("results[0].classification", equalTo("version_conflict"))
                .body("results[0].conflict.serverVersion", equalTo(2))
                .body("results[0].conflict.resolutionHint", equalTo("manual_refresh"));
    }

    @Test
    void shouldSyncAnimalReproductionEventCreateAndPullIncrementally() {
        UUID motherUuid = UUID.fromString("7f6a34a1-f8f4-492d-b9c9-b5b5a79635f4");
        UUID calfUuid = UUID.fromString("8f6a34a1-f8f4-492d-b9c9-b5b5a79635f4");
        QuarkusTransaction.requiringNew().run(() -> {
            animalRepository.persist(buildAnimal(motherUuid, "BO-0024", 0L, LocalDateTime.of(2026, 4, 26, 10, 0)));
            animalRepository.persist(buildAnimal(calfUuid, "BO-0025", 0L, LocalDateTime.of(2026, 4, 26, 10, 0)));
        });
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "1f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "entityType": "ANIMAL_REPRODUCTION_EVENT",
                              "entityId": "1f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "reproductionEventType": "BIRTH",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Parto controlado",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "operationId": "1f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                                "metadata": {
                                  "birthDate": "2026-04-26T10:03:00Z",
                                  "offspringCount": 1,
                                  "motherAnimalUuid": "%s",
                                  "offspringAnimalUuids": ["%s"]
                                }
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(motherUuid, currentUserIdFor("root-admin"), motherUuid, calfUuid))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(1))
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[0].entityType", equalTo("ANIMAL_REPRODUCTION_EVENT"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL_REPRODUCTION_EVENT")
                .queryParam("cursorUpdatedAt", "2026-04-26T10:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(motherUuid.toString()))
                .body("items[0].reproductionEventType", equalTo("BIRTH"));
    }

    @Test
    void shouldRejectAnimalReproductionEventMissingPayloadOperationIdThroughSyncResource() {
        UUID animalUuid = UUID.fromString("eba304eb-530a-4470-ad2d-c0a84639fe4c");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0026", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "8c0b546f-b163-43ce-afd8-e52f95b7be07",
                              "entityType": "ANIMAL_REPRODUCTION_EVENT",
                              "entityId": "pending-repro-1",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "reproductionEventType": "SERVICE",
                                "occurredAt": "2026-04-26T10:03:00Z",
                                "notes": "Servicio natural",
                                "performedByUserId": "%s",
                                "sourceChannel": "OFFLINE",
                                "metadata": { "serviceMethod": "NATURAL" }
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            }
                          ]
                        }
                        """.formatted(animalUuid, currentUserIdFor("root-admin")))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results[0].classification", equalTo("validation_error"))
                .body("results[0].conflict.reason", equalTo("ANIMAL_REPRODUCTION_EVENT_OPERATION_ID_REQUIRED"));
    }

    @Test
    void shouldSyncAnimalImageCreateAndPullWithoutBlockingPartialFailures() {
        UUID animalUuid = UUID.fromString("9f6a34a1-f8f4-492d-b9c9-b5b5a79635f4");
        QuarkusTransaction.requiringNew().run(() -> animalRepository.persist(buildAnimal(animalUuid, "BO-0027", 0L, LocalDateTime.of(2026, 4, 26, 10, 0))));
        String token = loginAs("root-admin", "RootAdmin9");
        byte[] validContent = "valid-image".getBytes();
        byte[] invalidContent = "invalid-image".getBytes();

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "operations": [
                            {
                              "operationId": "3f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "entityType": "ANIMAL_IMAGE",
                              "entityId": "3f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "operationId": "3f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                                "mimeType": "image/jpeg",
                                "fileName": "vaca.jpg",
                                "sizeBytes": %s,
                                "checksumSha256": "%s",
                                "base64Data": "%s",
                                "capturedAt": "2026-04-26T10:03:00Z",
                                "sourceChannel": "OFFLINE"
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:03:00Z",
                              "clientUpdatedAt": "2026-04-26T10:03:00Z"
                            },
                            {
                              "operationId": "4f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "entityType": "ANIMAL_IMAGE",
                              "entityId": "4f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                              "opType": "CREATE",
                              "payload": {
                                "animalUuid": "%s",
                                "operationId": "4f1e3d8f-65b6-4ca3-a073-54dfa6d18d95",
                                "mimeType": "image/webp",
                                "fileName": "vaca.webp",
                                "sizeBytes": %s,
                                "checksumSha256": "%s",
                                "base64Data": "%s",
                                "capturedAt": "2026-04-26T10:04:00Z",
                                "sourceChannel": "OFFLINE"
                              },
                              "baseVersion": 0,
                              "clientCreatedAt": "2026-04-26T10:04:00Z",
                              "clientUpdatedAt": "2026-04-26T10:04:00Z"
                            }
                          ]
                        }
                        """.formatted(
                        animalUuid,
                        validContent.length,
                        bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport.sha256Hex(validContent),
                        java.util.Base64.getEncoder().encodeToString(validContent),
                        animalUuid,
                        invalidContent.length,
                        bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport.sha256Hex(invalidContent),
                        java.util.Base64.getEncoder().encodeToString(invalidContent)))
                .when()
                .post("/api/sync/push")
                .then()
                .statusCode(200)
                .body("results", hasSize(2))
                .body("results[0].classification", equalTo("no_conflict"))
                .body("results[1].classification", equalTo("validation_error"))
                .body("results[1].conflict.reason", equalTo("ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED"));

        given()
                .auth().oauth2(token)
                .queryParam("entityType", "ANIMAL_IMAGE")
                .queryParam("cursorUpdatedAt", "2026-04-26T10:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(animalUuid.toString()))
                .body("items[0].mimeType", equalTo("image/jpeg"));

        org.junit.jupiter.api.Assertions.assertEquals(1, animalImageRepository.count());
    }

    @Test
    void shouldPullNotificationItemsOnlyForTheAuthenticatedGanaderoRecipient() {
        QuarkusTransaction.requiringNew().run(() -> {
            userRepository.persist(buildManagedUser(UUID.fromString("3fed3e60-6e52-4a91-81db-b32e95fab1c1"), "notif-a", "notif-a@hato.bo", UserStatus.ACTIVE));
            userRepository.persist(buildManagedUser(UUID.fromString("7fdcd435-8a07-4990-8bdf-6287be3a1118"), "notif-b", "notif-b@hato.bo", UserStatus.ACTIVE));
            ganaderoRepository.persist(buildGanadero(
                    UUID.fromString("95ba935b-7418-4eb1-a5e9-8d94d27191ef"),
                    "NIT-NOTIF-A",
                    "Ganadero Notif A",
                    "notif-a@hato.bo",
                    true,
                    LocalDateTime.of(2026, 4, 28, 10, 0)));
            ganaderoRepository.persist(buildGanadero(
                    UUID.fromString("75feb7f8-802b-43ff-b7fb-9696367e9358"),
                    "NIT-NOTIF-B",
                    "Ganadero Notif B",
                    "notif-b@hato.bo",
                    true,
                    LocalDateTime.of(2026, 4, 28, 10, 0)));
        });

        String adminToken = loginAs("root-admin", "RootAdmin9");
        String recipientAId = currentUserIdFor("notif-a");
        String recipientBId = currentUserIdFor("notif-b");

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "title": "Aviso A",
                          "body": "Llega solo al usuario A.",
                          "targetingMode": "EXPLICIT_LIST",
                          "includeUserIds": ["%s"],
                          "excludeUserIds": []
                        }
                        """.formatted(recipientAId))
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(201);

        given()
                .auth().oauth2(adminToken)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", UUID.randomUUID().toString())
                .body("""
                        {
                          "title": "Aviso B",
                          "body": "Llega solo al usuario B.",
                          "targetingMode": "EXPLICIT_LIST",
                          "includeUserIds": ["%s"],
                          "excludeUserIds": []
                        }
                        """.formatted(recipientBId))
                .when()
                .post("/api/admin/notifications")
                .then()
                .statusCode(201);

        String recipientAToken = loginAs("notif-a", "CampoUser9");

        given()
                .auth().oauth2(recipientAToken)
                .queryParam("entityType", "NOTIFICATION")
                .queryParam("cursorUpdatedAt", "2026-04-26T09:00:00Z")
                .queryParam("cursorId", "00000000-0000-0000-0000-000000000001")
                .when()
                .get("/api/sync/pull")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].title", equalTo("Aviso A"))
                .body("items[0].body", equalTo("Llega solo al usuario A."));
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

    private String currentUserIdFor(String username) {
        return QuarkusTransaction.requiringNew().call(() -> userRepository.findByUsernameOrEmail(username).orElseThrow().getId().toString());
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

    private User buildManagedUser(UUID id, String username, String email, UserStatus status) {
        User user = buildUser(username, email, Role.GANADERO, "CampoUser9");
        user.setId(id);
        user.setStatus(status);
        return user;
    }

    private Animal buildAnimal(UUID uuid, String tag, Long version, LocalDateTime updatedAt) {
        return buildAnimal(uuid, tag, DEFAULT_OWNER_GANADERO_ID, version, updatedAt);
    }

    private Animal buildAnimal(UUID uuid, String tag, UUID ownerGanaderoId, Long version, LocalDateTime updatedAt) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode("CODE-" + tag);
        animal.setTag(tag);
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerGanaderoId).orElseThrow());
        animal.setArete(tag);
        animal.setAreteNormalized(tag.trim().toLowerCase());
        animal.setMarca("CODE-" + tag);
        animal.setMarcaNormalized(("CODE-" + tag).toLowerCase());
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
            animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("410.00"));
        animal.setVersion(version);
        animal.setCreatedAt(updatedAt.minusDays(1));
        animal.setUpdatedAt(updatedAt);
        return animal;
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name, boolean active, LocalDateTime updatedAt) {
        return buildGanadero(id, businessIdentifier, name, null, active, updatedAt);
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name, String email, boolean active, LocalDateTime updatedAt) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(name);
        ganadero.setEmail(email);
        ganadero.setActive(active);
        return ganadero;
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
